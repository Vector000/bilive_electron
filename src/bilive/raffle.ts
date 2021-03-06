import tools from './lib/tools'
import AppClient from './lib/app_client'
import { liveOrigin, apiLiveOrigin, smallTVPathname, rafflePathname, lotteryPathname, _options } from './index'
/**
 * 自动参与抽奖
 *
 * @class Raffle
 */
class Raffle {
  /**
   * 创建一个 Raffle 实例
   * @param {raffleOptions} raffleOptions
   * @memberof Raffle
   */
  constructor(raffleOptions: raffleOptions) {
    this._options = raffleOptions
  }
  /**
   * 抽奖设置
   *
   * @private
   * @type {raffleOptions}
   * @memberof Raffle
   */
  private _options: raffleOptions
  /**
   * 抽奖地址
   *
   * @private
   * @type {string}
   * @memberof Raffle
   */
  private _url!: string
  /**
   * 开始抽奖
   *
   * @memberof Raffle
   */
  public async Start() {
    await tools.XHR({
      method: 'POST',
      uri: `${apiLiveOrigin}/room/v1/Room/room_entry_action`,
      body:  `room_id=${this._options.roomID}&platform=pc&csrf_token=${tools.getCookie(this._options.user.jar, 'bili_jct')}`,
      jar: this._options.user.jar,
      json: true,
      headers: { 'Referer': `${liveOrigin}/${tools.getShortRoomID(this._options.roomID)}` }
    })
    await tools.Sleep(5 * 1000)
    switch (this._options.cmd) {
      case 'smallTV':
        this._url = apiLiveOrigin + smallTVPathname
        this._Raffle()
        break
      case 'raffle':
        this._url = apiLiveOrigin + rafflePathname
        this._Raffle()
        break
      case 'lottery':
        this._url = apiLiveOrigin + lotteryPathname
        this._Lottery()
        break
      default:
        break
    }
  }
  /**
   * 抽奖Raffle
   *
   * @private
   * @memberof Raffle
   */
  private async _Raffle() {
    if (!this._options.user.userData.appraffle) {
      const raffleJoin = await tools.XHR<raffleJoin>({
        uri: `${apiLiveOrigin}/gift/v3/smalltv/join?roomid=${this._options.roomID}&raffleId=${this._options.raffleId}`,
        jar: this._options.user.jar,
        json: true,
        headers: { 'Referer': `${liveOrigin}/${tools.getShortRoomID(this._options.roomID)}` }
      })
      if (raffleJoin === undefined || raffleJoin.response.statusCode !== 200) return
      if (raffleJoin.body.code === 0) {
        if (this._options.user.userData.ban === true) {
          tools.sendSCMSG(`${this._options.user.nickname} 已解除封禁`)
          this._options.user.userData.ban = false
          this._options.user.userData.banTime = 0
        }
        await tools.Sleep(this._options.time * 1000 + 15 * 1000)
        this._RaffleReward()
      }
      else tools.Log(this._options.user.nickname, this._options.title, this._options.raffleId, raffleJoin.body)
      if (raffleJoin.body.code === 400 && raffleJoin.body.msg === '访问被拒绝') {
        if (this._options.user.userData.ban === false) {
          tools.sendSCMSG(`${this._options.user.nickname} 已被封禁`)
          this._options.user.userData.ban = true
        }
        this._options.user.userData.banTime = new Date().getTime()
        tools.Options(_options)
      }
    }
    else this._RaffleAward()
  }
  /**
   * 获取抽奖结果
   *
   * @private
   * @memberof Raffle
   */
  private async _RaffleAward() {
    const raffleAward = await tools.XHR<raffleAward>({
      method: 'POST',
      uri: `${this._url}/getAward`,
      body: AppClient.signQueryBase(`${this._options.user.tokenQuery}&raffleId=${this._options.raffleId}&roomid=${this._options.roomID}&type=${this._options.type}`),
      jar: this._options.user.jar,
      json: true,
      headers: this._options.user.headers
    }, 'Android')
    if (raffleAward === undefined || raffleAward.response.statusCode !== 200) return
    if (raffleAward.body.code === -401) {
      await tools.Sleep(30 * 1000)
      this._RaffleAward()
    }
    else if (raffleAward.body.code === 0) {
      if (this._options.user.userData.ban === true) {
        tools.sendSCMSG(`${this._options.user.nickname} 已解除封禁`)
        this._options.user.userData.ban = false
        this._options.user.userData.banTime = 0
      }
      const gift = raffleAward.body.data
      if (gift.gift_num === 0) tools.Log(this._options.user.nickname, `抽奖 ${this._options.raffleId}`, raffleAward.body.msg)
      else {
        const msg = `${this._options.user.nickname} ${this._options.title} ${this._options.raffleId} 获得 ${gift.gift_num} 个${gift.gift_name}`
        tools.Log(msg)
        if (gift.gift_name.includes('小电视')) tools.sendSCMSG(msg)
      }
    }
    else tools.Log(this._options.user.nickname, this._options.title, this._options.raffleId, raffleAward.body)
    if (raffleAward.body.code === 400 && raffleAward.body.msg === '访问被拒绝') {
      if (this._options.user.userData.ban === false) {
        tools.sendSCMSG(`${this._options.user.nickname} 已被封禁`)
        this._options.user.userData.ban = true
        tools.Options(_options)
      }
      this._options.user.userData.banTime = new Date().getTime()
    }
  }
  /**
   * 获取抽奖结果(v3 only)
   *
   * @private
   * @memberof Raffle
   */
  private async _RaffleReward() {
    const raffleReward = await tools.XHR<raffleReward>({
      uri: `${apiLiveOrigin}/gift/v3/smalltv/notice?roomid=${this._options.roomID}&raffleId=${this._options.raffleId}`,
      jar: this._options.user.jar,
      json: true,
      headers: { 'Referer': `${liveOrigin}/${tools.getShortRoomID(this._options.roomID)}` }
    })
    if (raffleReward === undefined || raffleReward.response.statusCode !== 200) return
    if (raffleReward.body.code === -400 || raffleReward.body.data.status === 3) {
      await tools.Sleep(30 * 1000)
      this._RaffleReward()
    }
    else {
      const gift = raffleReward.body.data
      if (gift.gift_num === 0) tools.Log(this._options.user.nickname, `抽奖 ${this._options.raffleId}`, raffleReward.body.msg)
      else {
        const msg = `${this._options.user.nickname} ${this._options.title} ${this._options.raffleId} 获得 ${gift.gift_num} 个${gift.gift_name}`
        tools.Log(msg)
        if (gift.gift_name.includes('小电视')) tools.sendSCMSG(msg)
      }
    }
  }
  /**
   * 抽奖Lottery
   *
   * @memberof Raffle
   */
  public async _Lottery() {
    await tools.Sleep(60 * 1000)
    const lotteryReward = await tools.XHR<lotteryReward>({
      method: 'POST',
      uri: `${this._url}/join`,
      body: AppClient.signQueryBase(`${this._options.user.tokenQuery}&id=${this._options.raffleId}&roomid=${this._options.roomID}&type=${this._options.type}`),
      jar: this._options.user.jar,
      json: true,
      headers: this._options.user.headers
    }, 'Android')
    if (lotteryReward !== undefined && lotteryReward.response.statusCode === 200) {
      if (lotteryReward.body.code === 0)
        tools.Log(this._options.user.nickname, this._options.title, this._options.raffleId, lotteryReward.body.data.message)
      else tools.Log(this._options.user.nickname, this._options.title, this._options.raffleId, lotteryReward.body)
    }
  }
}
export default Raffle
