import { randomBytes } from 'crypto'
import { EventEmitter } from 'events'
import tools from './lib/tools'
import User from './user'
import { _options, _user } from './index'
import { ipcMain } from 'electron'

/**
 * 程序设置
 *
 * @class Options
 * @extends {EventEmitter}
 */
class Options extends EventEmitter {

  constructor() {
    super()
  }

  public Start() {
    this._ipcListener()
  }

  private async _ipcListener() {
    ipcMain.on('RTOM', async (event: any, arg: message) => {
      const cmd = arg.cmd
      switch (arg.cmd) {
        case 'getConfig': { // 获取配置
          const data = _options.config
          event.sender.send('MTOR', { cmd, data })
        }
          break
        case 'setConfig': { // 保存设置
          const config = _options.config
          const setConfig = <config>arg.data || {}
          let msg = ''
          for (const i in config) {
            if (typeof config[i] !== typeof setConfig[i]) {
              // 一般都是自用, 做一个简单的验证就够了
              msg = i + '参数错误'
              break
            }
          }
          if (msg === '') {
            // 防止setConfig里有未定义属性, 不使用Object.assign
            for (const i in config) config[i] = setConfig[i]
            tools.Options(_options)
            event.sender.send('MTOR', { cmd: 'alertMsg', data: `config修改成功` })
          }
          else event.sender.send('MTOR', { cmd: 'errorMsg', data: msg })
        }
          break
        // 获取uid
        case 'getAllUID': {
          _user.forEach(user => user.getUserInfo())
          const data = Object.keys(_options.user)
          event.sender.send('MTOR', { cmd, data })
        }
          break
        // 获取用户设置
        case 'getUserData': {
          const user = _options.user
          const getUID = arg.uid
          if (typeof getUID === 'string' && user[getUID] !== undefined) event.sender.send('MTOR', { cmd, uid: getUID, data: user[getUID] })
          else event.sender.send('MTOR', { cmd: 'errorMsg', data: '未知用户' })
        }
          break
        // 保存用户设置
        case 'setUserData': {
          const user = _options.user
          const setUID = arg.uid
          if (setUID !== undefined && user[setUID] !== undefined) {
            const userData = user[setUID]
            const setUserData = <userData>arg.data || {}
            let msg = ''
            let captcha = ''
            for (const i in userData) {
              if (typeof userData[i] !== typeof setUserData[i]) {
                msg = i + '参数错误'
                break
              }
            }
            if (msg === '') {
              for (const i in userData) userData[i] = setUserData[i]
              if (userData.status && !_user.has(setUID)) {
                // 因为使用了Map保存已激活的用户, 所以需要添加一次
                const newUser = new User(setUID, userData)
                const status = await newUser.Start()
                // 账号会尝试登录, 如果需要验证码status会返回'captcha', 并且验证码会以DataUrl形式保存在captchaJPEG
                if (status === 'captcha') captcha = newUser.captchaJPEG
                else if (_user.has(setUID)) {
                  newUser.daily()
                  newUser.getUserInfo()
                }
              }
              else if (userData.status && _user.has(setUID)) {
                // 对于已经存在的用户, 可能处在验证码待输入阶段
                const captchaUser = <User>_user.get(setUID)
                if (captchaUser.captchaJPEG !== '' && arg.captcha !== undefined) {
                  // 对于这样的用户尝试使用验证码登录
                  captchaUser.captcha = arg.captcha
                  const status = await captchaUser.Start()
                  if (status === 'captcha') captcha = captchaUser.captchaJPEG
                  else if (_user.has(setUID)) captchaUser.daily()
                }
              }
              else if (!userData.status && _user.has(setUID)) (<User>_user.get(setUID)).Stop()
              tools.Options(_options)
              if (captcha === '') event.sender.send('MTOR', { cmd: 'alertMsg', data: `用户设置保存成功` })
              else event.sender.send('MTOR', { cmd: 'captcha', uid: userData.nickname, captcha })
            }
            else event.sender.send('MTOR', { cmd: 'errorMsg', data: msg })
          }
          else event.sender.send('MTOR', { cmd: 'errorMsg', data: `未知用户` })
        }
          break
        // 删除用户设置
        case 'delUserData': {
          const user = _options.user
          const delUID = arg.uid
          if (delUID !== undefined && user[delUID] !== undefined) {
            delete _options.user[delUID]
            if (_user.has(delUID)) (<User>_user.get(delUID)).Stop()
            tools.Options(_options)
            event.sender.send('MTOR', { cmd: 'alertMsg', data: `删除用户成功` })
          }
          else event.sender.send('MTOR', { cmd: 'errorMsg', data: `未知用户` })
        }
          break
        // 新建用户设置
        case 'newUserData': {
          // 虽然不能保证唯一性, 但是这都能重复的话可以去买彩票
          const uid = randomBytes(16).toString('hex')
          const data = Object.assign({}, _options.newUserData)
          _options.user[uid] = data
          tools.Options(_options)
          event.sender.send('MTOR', { cmd: 'newUserData', uid: uid, data: data })
          event.sender.send('MTOR', { cmd: 'alertMsg', data: `新建用户成功` })
        }
          break
        // 送出指定礼物
        case 'sendGiftToRoom': {
          const uid = arg.uid
          const giftItem = <sendGiftItem>arg.data
          const user = new User(uid, _options.user[uid])
          user.sendGiftRoom(giftItem)
        }
          break
        // 未知命令
        default:
          event.sender.send('MTOR', { cmd: 'errorMsg', data: `未知命令` })
          break
      }
    })
  }

}

// ipc消息
interface message {
  cmd: string
  msg: string
  uid: string
  data: config | string[] | userData | sendGiftItem
  captcha: string
}
export default Options
export { message }
