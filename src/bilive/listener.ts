import { EventEmitter } from 'events'
import tools from './lib/tools'
import AppClient from './lib/app_client'
import DMclient from './dm_client_re'
import { apiLiveOrigin, smallTVPathname, rafflePathname, lotteryPathname, _options } from './index'
/**
 * 监听服务器消息
 *
 * @class Listener
 * @extends {EventEmitter}
 */
class Listener extends EventEmitter {
  constructor() {
    super()
  }
  /**
   * 用于接收弹幕消息
   *
   * @private
   * @type {Map<number, DMclient>}
   * @memberof Listener
   */
  private _DMclient: Map<number, DMclient> = new Map()
  /**
   * 记录缓存
   *
   * @private
   * @type {Map<number, number>}
   * @memberof Listener
   */
  private _smallTVID: Set<number> = new Set()
  private _raffleID: Set<number> = new Set()
  private _lotteryID: Set<number> = new Set()
  private _MSGCache: Set<string> = new Set()
  /**
   * 抽奖更新时间
   *
   * @private
   * @type {number}
   * @memberof Listener
   */
  private _lastUpdate: number = Date.now()
  /**
   * 开始监听
   *
   * @memberof Listener
   */
  public Start() {
    this.updateAreaRoom()
    // 3s清空一次消息缓存
    setInterval(() => this._MSGCache.clear(), 3 * 1000)
  }
  /**
   * 更新分区房间
   *
   * @memberof Listener
   */
  public async updateAreaRoom() {
    const userID = _options.config.defaultUserID
    // 获取直播列表
    const getAllList = await tools.XHR<getAllList>({
      uri: `${apiLiveOrigin}/room/v2/AppIndex/getAllList?${AppClient.baseQuery}`,
      json: true
    }, 'Android')
    if (getAllList !== undefined && getAllList.response.statusCode === 200 && getAllList.body.code === 0) {
      const roomIDs: Set<number> = new Set()
      // 获取房间列表
      getAllList.body.data.module_list.forEach(modules => {
        if (modules.module_info.type === 9 && modules.list.length > 2) {
          for (let i = 0; i < 3; i++) roomIDs.add((<getAllListDataRoomList>modules.list[i]).roomid)
        }
      })
      // 添加房间
      roomIDs.forEach(roomID => {
        if (this._DMclient.has(roomID)) return
        const newDMclient = new DMclient({ roomID, userID })
        newDMclient
          .on('SYS_MSG', dataJson => this._SYSMSGHandler(dataJson))
          .on('SYS_GIFT', dataJson => this._SYSGiftHandler(dataJson))
          .on('GUARD_MSG', dataJson => this._LotteryHandler(dataJson))
          .Connect()
        this._DMclient.set(roomID, newDMclient)
      })
      // 移除房间
      this._DMclient.forEach((roomDM, roomID) => {
        if (roomIDs.has(roomID)) return
        roomDM.removeAllListeners().Close()
        this._DMclient.delete(roomID)
      })
    }
  }
  /**
   * 清空所有ID缓存
   *
   * @memberof Listener
   */
  public clearAllID() {
    if (Date.now() - this._lastUpdate < 3 * 60 * 1000) return
    this._smallTVID.clear()
    this._raffleID.clear()
    this._lotteryID.clear()
  }
  /**
   * 监听弹幕系统消息
   *
   * @private
   * @param {SYS_MSG} dataJson
   * @memberof Listener
   */
  private async _SYSMSGHandler(dataJson: SYS_MSG) {
    if (dataJson.real_roomid === undefined || this._MSGCache.has(dataJson.msg_text)) return
    this._MSGCache.add(dataJson.msg_text)
    const url = apiLiveOrigin + smallTVPathname
    const roomID = dataJson.real_roomid
    await tools.Sleep(15 * 1000)
    this._RaffleCheck(url, roomID, 'smallTV')
  }
  /**
   * 监听系统礼物消息
   *
   * @private
   * @param {SYS_GIFT} dataJson
   * @memberof Listener
   */
  private async _SYSGiftHandler(dataJson: SYS_GIFT) {
    if (dataJson.real_roomid === undefined || dataJson.giftId === undefined || this._MSGCache.has(dataJson.msg_text)) return
    this._MSGCache.add(dataJson.msg_text)
    const url = apiLiveOrigin + rafflePathname
    const roomID = dataJson.real_roomid
    this._RaffleCheck(url, roomID, 'raffle')
  }
  /**
   * 监听Lottery消息
   *
   * @private
   * @param {GUARD_MSG} dataJson
   * @memberof Listener
   */
  private async _LotteryHandler(dataJson: GUARD_MSG) {
    const url = apiLiveOrigin + lotteryPathname
    const rege = /(?:(主播 )).*(?=( 的直播间开通了总督))/
    const res = rege.exec(dataJson.msg)
    if (res === null) return
    const upID = res[0].toString().substr(3)
    const searchCheck = await tools.XHR<searchID>({
      uri: encodeURI('https://search.bilibili.com/api/search?search_type=live&keyword=' + upID),
      json: true
    })
    if (searchCheck === undefined || searchCheck.body.result.live_user === null) return
    const roomID = searchCheck.body.result.live_user[0].roomid
    this._LotteryCheck(url, roomID)
  }
  /**
   * 检查房间抽奖raffle信息
   *
   * @private
   * @param {string} url
   * @param {number} roomID
   * @param {('smallTV' | 'raffle')} raffle
   * @memberof Listener
   */
  private async _RaffleCheck(url: string, roomID: number, raffle: 'smallTV' | 'raffle') {
    const raffleCheck = await tools.XHR<raffleCheck>({
      uri: `${url}/check?${AppClient.signQueryBase(`roomid=${roomID}`)}`,
      json: true
    }, 'Android')
    if (raffleCheck !== undefined && raffleCheck.response.statusCode === 200
      && raffleCheck.body.code === 0 && raffleCheck.body.data.list.length > 0) {
      raffleCheck.body.data.list.forEach(data => {
        const message: message = {
          cmd: raffle,
          roomID,
          id: +data.raffleId,
          type: data.type,
          title: data.title,
          time: +data.time_wait
        }
        this._RaffleHandler(message)
      })
    }
  }
  /**
   * 检查房间抽奖lottery信息
   *
   * @private
   * @param {string} url
   * @param {number} roomID
   * @memberof Listener
   */
  private async _LotteryCheck(url: string, roomID: number) {
    const lotteryCheck = await tools.XHR<lotteryCheck>({
      uri: `${url}/check?${AppClient.signQueryBase(`roomid=${roomID}`)}`,
      json: true
    }, 'Android')
    if (lotteryCheck !== undefined && lotteryCheck.response.statusCode === 200
      && lotteryCheck.body.code === 0 && lotteryCheck.body.data.guard.length > 0) {
      lotteryCheck.body.data.guard.forEach(data => {
        const message: message = {
          cmd: 'lottery',
          roomID,
          id: +data.id,
          type: data.keyword,
          title: '总督抽奖',
          time: 0
        }
        this._RaffleHandler(message)
      })
    }
  }
  /**
   * 监听抽奖消息
   *
   * @private
   * @param {message} raffleMSG
   * @memberof Listener
   */
  private async _RaffleHandler(raffleMSG: message) {
    const roomID = raffleMSG.roomID
    const id = raffleMSG.id
    switch (raffleMSG.cmd) {
      case 'smallTV':
        if (this._smallTVID.has(id)) return
        this._smallTVID.add(id)
        break
      case 'raffle':
        if (this._raffleID.has(id)) return
        this._raffleID.add(id)
        break
      case 'lottery':
        if (this._lotteryID.has(id)) return
        this._lotteryID.add(id)
        break
      default: return
    }
    this.emit('raffle', raffleMSG)
    tools.Log(`房间 ${tools.getShortRoomID(roomID)} 开启了第 ${id} 轮${raffleMSG.title}`)
    await tools.Sleep(3 * 1000)
  }
}
export default Listener
