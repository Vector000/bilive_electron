import tools from './lib/tools'
import Online from './online'
import AppClient from './lib/app_client'
import { liveOrigin, apiVCOrigin, apiLiveOrigin, _options, _user } from './index'
import { webContents } from 'electron'
/**
 * Creates an instance of User.
 *
 * @class User
 * @extends {Online}
 */
class User extends Online {
  /**
   * Creates an instance of User.
   * @param {string} uid
   * @param {userData} userData
   * @memberof User
   */
  constructor(uid: string, userData: userData) {
    super(userData)
    this.uid = uid
  }
  // 存储用户信息
  public uid: string
  // 用户状态
  private _sign = false
  private _treasureBox = false
  private _eventRoom = false
  private _silver2coin = false
  /**
   * 当账号出现异常时, 会返回'captcha'或'stop'
   * 'captcha'为登录需要验证码, 若无法处理需Stop()
   *
   * @returns {(Promise<'captcha' | 'stop' | void>)}
   * @memberof User
   */
  public Start(): Promise<'captcha' | 'stop' | void> {
    if (!_user.has(this.uid)) _user.set(this.uid, this)
    return super.Start()
  }
  /**
   * 停止挂机
   *
   * @memberof User
   */
  public Stop() {
    _user.delete(this.uid)
    return super.Stop()
  }
  /**
   * 零点重置
   * 为了少几个定时器, 统一由外部调用
   *
   * @memberof User
   */
  public async nextDay() {
    // 每天刷新token和cookie
    const refresh = await this.refresh()
    if (refresh.status === AppClient.status.success) {
      this.jar = tools.setCookie(this.cookieString)
      tools.Options(_options)
    }
    else if (refresh.status === AppClient.status.error) {
      const status = await this._tokenError()
      if (status !== undefined) return this.Stop()
    }
    this._sign = false
    this._treasureBox = false
    this._eventRoom = false
    this._silver2coin = false
  }
  /**
   * 日常
   *
   * @memberof User
   */
  public async daily() {
    await this.sign()
    this.treasureBox()
    this.eventRoom()
    this.silver2coin()
    this.sendGift()
    this.signGroup()
  }
  /**
   * 每日签到
   *
   * @memberof User
   */
  public async sign() {
    if (this._sign || !this.userData.doSign) return
    let ok = 0
    // 签到
    const signInfo = await tools.XHR<signInfo>({
      uri: `${apiLiveOrigin}/AppUser/getSignInfo?${AppClient.signQueryBase(this.tokenQuery)}`,
      json: true,
      headers: this.headers
    }, 'Android')
    if (signInfo !== undefined && signInfo.response.statusCode === 200 && signInfo.body.code === 0) {
      ok++
      tools.Log(this.nickname, '每日签到', '已签到')
    }
    // 道具包裹
    const getBagGift = await tools.XHR<getBagGift>({
      uri: `${apiLiveOrigin}/AppBag/getSendGift?${AppClient.signQueryBase(this.tokenQuery)}`,
      json: true,
      headers: this.headers
    }, 'Android')
    if (getBagGift !== undefined && getBagGift.response.statusCode === 200 && getBagGift.body.code === 0) {
      ok++
      tools.Log(this.nickname, '每日签到', '已获取每日包裹')
    }
    if (ok === 2) this._sign = true
  }
  /**
   * 每日宝箱
   *
   * @memberof User
   */
  public async treasureBox() {
    if (this._treasureBox || !this.userData.treasureBox) return
    if (new Date().getTime() - this.userData.banTime < 5 * 60 * 60 * 1000) return // 5h ban determine
    // 获取宝箱状态,换房间会重新冷却
    const currentTask = await tools.XHR<currentTask>({
      uri: `${apiLiveOrigin}/mobile/freeSilverCurrentTask?${AppClient.signQueryBase(this.tokenQuery)}`,
      json: true,
      headers: this.headers
    }, 'Android')
    if (currentTask === undefined) return
    if (currentTask.response.statusCode === 200) {
      if (currentTask.body.code === 0) {
        await tools.Sleep(currentTask.body.data.minute * 6e4)
        await tools.XHR<award>({
          uri: `${apiLiveOrigin}/mobile/freeSilverAward?${AppClient.signQueryBase(this.tokenQuery)}`,
          json: true,
          headers: this.headers
        }, 'Android')
        this.treasureBox()
      }
      else if (currentTask.body.code === -10017) {
        this._treasureBox = true
        tools.Log(this.nickname, '每日宝箱', '已领取所有宝箱')
      }
    }
    else if (currentTask.body.code === 400 && currentTask.body.msg === '访问被拒绝') {
      if (this.userData.ban === false) {
        tools.sendSCMSG(`${this.nickname} 已被封禁`)
        this.userData.ban = true
      }
      this.userData.banTime = new Date().getTime()
      tools.Options(_options)
    }
  }
  /**
   * 每日任务
   *
   * @memberof User
   */
  public async eventRoom() {
    if (this._eventRoom || !this.userData.eventRoom) return
    const tasks = []
    // 获取任务列表
    const roomID = _options.config.eventRooms[0]
    const taskInfo = await tools.XHR<taskInfo>({
      uri: `${apiLiveOrigin}/i/api/taskInfo`,
      jar: this.jar,
      json: true,
      headers: { 'Referer': `${liveOrigin}/${tools.getShortRoomID(roomID)}` }
    })
    if (taskInfo === undefined || taskInfo.response.statusCode !== 200) return
    if (taskInfo.body.code == 0) {
      const taskData = taskInfo.body.data
      for (const i in taskData) if (taskData[i].task_id !== undefined) tasks.push(taskData[i].task_id)
      // 做任务
      let ok = 0
      for (const taskID of tasks) {
        const taskres = await tools.XHR({
          method: 'POST',
          uri: `${apiLiveOrigin}/activity/v1/task/receive_award`,
          body: `task_id=${taskID}`,
          jar: this.jar,
          json: true,
          headers: { 'Referer': `${liveOrigin}/${tools.getShortRoomID(roomID)}` }
        })
        if (taskres !== undefined && taskres.response.statusCode === 200 && (taskres.response.body.code === 0 || taskres.response.body.code === -400)) ok++
        if (ok === tasks.length) {
          this._eventRoom = true
          tools.Log(this.nickname, '每日任务', '每日任务已完成')
        }
        await tools.Sleep(3000)
      }
    }
    else tools.Log(this.nickname, '每日任务', taskInfo.body.msg)
  }
  /**
   * 银瓜子兑换硬币
   *
   * @memberof User
   */
  public async silver2coin() {
    if (this._silver2coin || !this.userData.silver2coin) return
    const silver2coin = await tools.XHR<silver2coin>({
      method: 'POST',
      uri: `${apiLiveOrigin}/AppExchange/silver2coin?${AppClient.signQueryBase(this.tokenQuery)}`,
      json: true,
      headers: this.headers
    }, 'Android')
    if (silver2coin === undefined || silver2coin.response.statusCode !== 200) return tools.Log(this.nickname, '银瓜子兑换硬币兑换失败')
    if (silver2coin.body.code === 0) {
      this._silver2coin = true
      tools.Log(this.nickname, '银瓜子兑换硬币', '成功兑换 1 个硬币')
    }
    else if (silver2coin.body.code === 403) {
      this._silver2coin = true
      tools.Log(this.nickname, '银瓜子兑换硬币', silver2coin.body.msg)
    }
    else tools.Log(this.nickname, '银瓜子兑换硬币', '兑换失败', silver2coin.body)
  }
  /**
   * 指定送礼
   *
   * @memberof User
   */
  public async sendGiftRoom(sendItem: sendGiftItem) {
    const roomInfo = await tools.XHR<roomInfo>({
      uri: `${apiLiveOrigin}/AppRoom/index?${AppClient.signQueryBase(`room_id=${sendItem.sendRoom}`)}`,
      json: true
    }, 'Android')
    if (roomInfo === undefined || roomInfo.response.statusCode !== 200) return
    if (roomInfo.body.code === 0) {
      const mid = roomInfo.body.data.mid
      const sendBag = await tools.XHR<sendBag>({
        method: 'POST',
        uri: `${apiLiveOrigin}/gift/v2/live/bag_send`,
        body: AppClient.signQueryBase(`bag_id=${sendItem.bagId}&biz_code=live&biz_id=${sendItem.sendRoom}&gift_id=${sendItem.id}&gift_num=${sendItem.sendNum}&ruid=${mid}&uid=${this.userData.biliUID}&rnd=${AppClient.RND}&${this.tokenQuery}`),
        json: true,
        headers: this.headers
      }, 'Android')
      let allContents = webContents.getAllWebContents()
      if (sendBag !== undefined && sendBag.response.statusCode === 200 && sendBag.body.code === 0) {
        allContents.forEach((windowContent) => {
          windowContent.send('MTOR', { cmd: 'sendGiftReturn', success: true })
        })
      }
      else {
        allContents.forEach((windowContent) => {
          windowContent.send('MTOR', { cmd: 'sendGiftReturn', success: false })
        })
      }
    }
  }
  /**
   * 自动送礼
   *
   * @memberof User
   */
  public async sendGift() {
    if (!this.userData.sendGift || this.userData.sendGiftRoom === 0) return
    const roomID = this.userData.sendGiftRoom
    // 获取房间信息
    const roomInfo = await tools.XHR<roomInfo>({
      uri: `${apiLiveOrigin}/AppRoom/index?${AppClient.signQueryBase(`room_id=${roomID}`)}`,
      json: true
    }, 'Android')
    if (roomInfo === undefined || roomInfo.response.statusCode !== 200) return
    if (roomInfo.body.code === 0) {
      // masterID
      const mid = roomInfo.body.data.mid
      const room_id = roomInfo.body.data.room_id
      // 获取包裹信息
      const bagInfo = await tools.XHR<bagInfo>({
        uri: `${apiLiveOrigin}/gift/v2/gift/m_bag_list?${AppClient.signQueryBase(this.tokenQuery)}`,
        json: true,
        headers: this.headers
      }, 'Android')
      if (bagInfo === undefined || bagInfo.response.statusCode !== 200) return
      if (bagInfo.body.code === 0) {
        if (bagInfo.body.data.length > 0) {
          for (const giftData of bagInfo.body.data) {
            if (giftData.expireat > 0 && giftData.expireat < 12 * 60 * 60) {
              // expireat单位为分钟, 永久礼物值为0
              const sendBag = await tools.XHR<sendBag>({
                method: 'POST',
                uri: `${apiLiveOrigin}/gift/v2/live/bag_send`,
                body: AppClient.signQueryBase(`bag_id=${giftData.id}&biz_code=live&biz_id=${room_id}&gift_id=${giftData.gift_id}&gift_num=${giftData.gift_num}&ruid=${mid}&uid=${giftData.uid}&rnd=${AppClient.RND}&${this.tokenQuery}`),
                json: true,
                headers: this.headers
              }, 'Android')
              if (sendBag === undefined || sendBag.response.statusCode !== 200) continue
              if (sendBag.body.code === 0) {
                const sendBagData = sendBag.body.data
                tools.Log(this.nickname, '自动送礼', `向房间 ${roomID} 赠送 ${sendBagData.gift_num} 个${sendBagData.gift_name}`)
              }
              else tools.Log(this.nickname, '自动送礼', `向房间 ${roomID} 赠送 ${giftData.gift_num} 个${giftData.gift_name} 失败`, sendBag.body)
              await tools.Sleep(3000)
            }
          }
        }
      }
      else tools.Log(this.nickname, '自动送礼', '获取包裹信息失败', bagInfo.body)
    }
    else tools.Log(this.nickname, '自动送礼', '获取房间信息失败', roomInfo.body)
  }
  /**
   * 自动送礼V2？
   *
   * @memberof User
   */
  public async autoSend() {
    if (!this.userData.autoSend) return
    // 获取佩戴勋章信息
    const uid = this.userData.biliUID
    const wearInfo = await tools.XHR<wearInfo>({
      method: `POST`,
      uri: `${apiLiveOrigin}/live_user/v1/userInfo/get_weared_medal`,
      body: `source=1&uid=${uid}&target_id=11153765&csrf_token=${tools.getCookie(this.jar, 'bili_jct')}`,//使用3号直播间查询
      json: true,
      jar: this.jar,
      headers: this.headers
    })
    if (wearInfo === undefined || wearInfo.response.statusCode !== 200 || wearInfo.body.code !== 0) return
    if (wearInfo.body.data !== null) {
      const room_id = wearInfo.body.data.roominfo.room_id
      const mid = wearInfo.body.data.roominfo.uid
      const day_limit = wearInfo.body.data.day_limit
      const today_feed  = parseInt(wearInfo.body.data.today_feed)
      let intimacy_needed = day_limit - today_feed
      if (intimacy_needed === 0) return tools.Log(this.nickname,`亲密度已达上限`)
      // 获取包裹信息
      let gift_value = 0, bag_value = 0, send_num = 0
      const bagInfo = await tools.XHR<bagInfo>({
        uri: `${apiLiveOrigin}/gift/v2/gift/m_bag_list?${AppClient.signQueryBase(this.tokenQuery)}`,
        json: true,
        headers: this.headers
      }, 'Android')
      if (bagInfo === undefined || bagInfo.response.statusCode !== 200) return
      if (bagInfo.body.code === 0) {
        if (bagInfo.body.data.length > 0) {
          for (const giftData of bagInfo.body.data) {
            if (giftData.expireat > 0) {
              switch (giftData.gift_id) {// Gift_Config from http://api.live.bilibili.com/gift/v3/live/gift_config
                case 1: gift_value = 1//辣条
                break
                case 3: gift_value = 99//B坷垃
                break
                case 4: gift_value = 52//喵娘
                break
                case 6: gift_value = 10//亿圆
                break
                case 9: gift_value = 4500//爱心便当
                break
                case 10: gift_value = 19900//蓝白胖次
                break
                case 30054: gift_value = 5000//粉丝卡，什么玩意儿
                break
                default: break
              }
              bag_value = gift_value * giftData.gift_num
              if (intimacy_needed >= bag_value) send_num = giftData.gift_num
              else send_num = Math.floor(intimacy_needed / gift_value)
              if (send_num > 0) {
                const sendBag = await tools.XHR<sendBag>({
                  method: 'POST',
                  uri: `${apiLiveOrigin}/gift/v2/live/bag_send`,
                  body: AppClient.signQueryBase(`bag_id=${giftData.id}&biz_code=live&biz_id=${room_id}&gift_id=${giftData.gift_id}&gift_num=${send_num}&ruid=${mid}&uid=${giftData.uid}&rnd=${AppClient.RND}&${this.tokenQuery}`),
                  json: true,
                  headers: this.headers
                }, 'Android')
                if (sendBag === undefined || sendBag.response.statusCode !== 200) continue
                if (sendBag.body.code === 0) {
                  const sendBagData = sendBag.body.data
                  tools.Log(this.nickname, '自动送礼V2', `向房间 ${room_id} 赠送 ${send_num} 个${sendBagData.gift_name}`)
                  intimacy_needed = intimacy_needed - send_num * gift_value
                  if (intimacy_needed === 0) return tools.Log(this.nickname,`亲密度已达上限`)
                }
                else tools.Log(this.nickname, '自动送礼V2', `向房间 ${room_id} 赠送 ${send_num} 个${giftData.gift_name} 失败`, sendBag.body)
                await tools.Sleep(5000)
              }
            }
          }
          tools.Log(this.nickname,`已完成送礼`)
        }
        else tools.Log(this.nickname,`包裹空空的`)
      }
      else tools.Log(this.nickname,`获取包裹信息失败`)
    }
    else tools.Log(this.nickname,`获取佩戴勋章信息失败`)
  }
  /**
   * 应援团签到
   *
   * @memberof User
   */
  public async signGroup() {
    if (!this.userData.signGroup) return
    // 获取已加入应援团列表
    const linkGroup = await tools.XHR<linkGroup>({
      uri: `${apiVCOrigin}/link_group/v1/member/my_groups?${AppClient.signQueryBase(this.tokenQuery)}`,
      json: true,
      headers: this.headers
    }, 'Android')
    if (linkGroup === undefined || linkGroup.response.statusCode !== 200) return
    if (linkGroup.body.code === 0) {
      if (linkGroup.body.data.list.length > 0) {
        for (const groupInfo of linkGroup.body.data.list) {
          const signGroup = await tools.XHR<signGroup>({
            uri: `${apiVCOrigin}/link_setting/v1/link_setting/sign_in?${AppClient.signQueryBase(`group_id=${groupInfo.group_id}&owner_id=${groupInfo.owner_uid}&${this.tokenQuery}`)}`,
            json: true,
            headers: this.headers
          }, 'Android')
          if (signGroup === undefined || signGroup.response.statusCode !== 200) continue
          if (signGroup.body.data.add_num > 0)
            tools.Log(this.nickname, '应援团签到', `在${groupInfo.group_name}签到获得 ${signGroup.body.data.add_num} 点亲密度`)
          else tools.Log(this.nickname, '应援团签到', `已在${groupInfo.group_name}签到过`)
          await tools.Sleep(3000)
        }
      }
    }
    else tools.Log(this.nickname, '应援团签到', '获取应援团列表失败', linkGroup.body)
  }
  /**
   * 获取个人信息
   *
   * @memberof User
   */
  public async getUserInfo() {
    const userInfo = await tools.XHR<userInfo>({
      uri: `${apiLiveOrigin}/User/getUserInfo?ts=${AppClient.TS}`,
      json: true,
      jar: this.jar,
      headers: this.headers
    })
    if (userInfo === undefined || userInfo.response.statusCode !== 200) return
    if (userInfo.body.code === 'REPONSE_OK') {
      const InfoData = userInfo.body.data
      this.userData.uname = InfoData.uname
      this.userData.lv = InfoData.user_level
      this.userData.exp = InfoData.user_intimacy
      this.userData.fullexp = InfoData.user_next_intimacy
      this.userData.rank = InfoData.user_level_rank
      this.userData.gold = InfoData.gold
      this.userData.silver = InfoData.silver
      this.userData.coin = InfoData.billCoin
      this.userData.achieve = InfoData.achieve
      this.userData.face = InfoData.face
      this.userData.vip = InfoData.vip
      this.userData.svip = InfoData.svip
    }
    let medalNum = 0
    const medalInfo = await tools.XHR<medalInfo>({
      uri: `${apiLiveOrigin}/i/api/medal?page=1&pageSize=25`,
      json: true,
      jar: this.jar,
      headers: this.headers
    })
    if (medalInfo === undefined) return
    else {
      if (medalInfo.response.statusCode === 200 && medalInfo.body.code === 0) {
        const medalData = medalInfo.body.data
        if (medalData.count === 0) this.userData.medal = ""
        else {
          medalData.fansMedalList.forEach((medal: medalInfoDataInfo) => {
  					if (medal.status === 1) {
              this.userData.medal = medal.medal_name
              this.userData.medalLv = medal.level
              this.userData.medalExp = medal.intimacy
              this.userData.medalFullExp = medal.next_intimacy
              this.userData.medalRank = medal.rank
              this.userData.medalUp = medal.target_name
              this.userData.medalTime = medal.receive_time
              this.userData.medalTodayFeed = medal.todayFeed
              this.userData.medalTodayLimit = medal.dayLimit
            }
  					else medalNum++
  				})
  				if (medalNum === medalData.count) this.userData.medal = ""
        }
      }
    }
    const bagInfo = await tools.XHR<bagInfo>({
      uri: `${apiLiveOrigin}/gift/v2/gift/m_bag_list?${AppClient.signQueryBase(this.tokenQuery)}`,
      json: true,
      headers: this.headers
    }, 'Android')
    if (bagInfo === undefined || bagInfo.response.statusCode !== 200) return
    if (bagInfo.body.code === 0) {
      let bagItem: any = []
      if (bagInfo.body.data.length > 0) {
        for (const giftData of bagInfo.body.data) {
          _options.giftID.forEach((gift) => {
            if (giftData.gift_id === gift.id) {
              bagItem.push({
                id: giftData.gift_id,
                bagId: giftData.id,
                name: gift.name,
                price: gift.price,
                img: gift.img,
                num: giftData.gift_num,
                expireat: giftData.expireat
              })
            }
          })
        }
      }
      this.userData.bag = bagItem
    }
    tools.Options(_options)
    let allContents = webContents.getAllWebContents()
    allContents.forEach((windowContent) => {
      windowContent.send('MTOR', { cmd: 'getUserData', uid: this.uid, data: this.userData })
    })
  }
  /**
   * 获取并领取不同房间的上船信息
   *
   * @memberof User
   */
   public async getGuard() {
     const guardInfosRAW = await tools.XHR({
       uri: `http://118.25.108.153:8080/guard`,
       json: true
     })
     if (guardInfosRAW === undefined) return
     let guardInfos = <guardInfos>({
       data: []
     })
     guardInfos.data = <guardInfo[]>guardInfosRAW.body
     for (let i=0;i<guardInfos.data.length;i++) {
       let guardInfo = guardInfos.data[i]
       let guardType = ''
       if (guardInfo.Guard === 'Governor') continue
       if (guardInfo.Guard === 'Praefect') guardType = '提督'
       if (guardInfo.Guard === 'Captain') guardType = '舰长'
       await tools.XHR({//_WebEntry 虽然好像没什么用还是写进来
         method: 'POST',
         uri: `${apiLiveOrigin}/room/v1/Room/room_entry_action`,
         jar: this.jar,
         json: true,
         headers: { 'Referer': `${liveOrigin}/${tools.getShortRoomID(guardInfo.OriginRoomId)}` }
       })
       const guardRoom = await tools.XHR<guardRoom>({
         uri: `${apiLiveOrigin}/lottery/v1/Lottery/check_guard?roomid=${guardInfo.OriginRoomId}`,
         json: true,
         headers: this.headers
       })
       await tools.Sleep(10 * 1000)
       if (guardRoom === undefined) continue
       if (guardRoom.body.code === 0 && guardRoom.body.data.length > 0) {
         guardRoom.body.data.forEach(async (data) => {
           const guardJoin = await tools.XHR<guardJoin>({
             method: 'POST',
             uri: `${apiLiveOrigin}/lottery/v2/Lottery/join`,
             body: `roomid=${guardInfo.OriginRoomId}&id=${data.id}&type=guard&csrf_token=${tools.getCookie(this.jar, 'bili_jct')}`,
             jar: this.jar,
             json: true,
             headers: this.headers
           })
           if (guardJoin === undefined) return
           if (guardJoin.body.code === 0) tools.Log(this.nickname, `${guardInfo.OriginRoomId} ${guardType}奖励`, guardJoin.body.data.message)
           await tools.Sleep(10 * 1000)
         })
       }
       await tools.Sleep(30 * 1000)
     }
     tools.Log(this.nickname, `已完成提督、舰长亲密度检查`)
   }
}
export default User
