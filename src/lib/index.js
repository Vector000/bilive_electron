const { ipcRenderer } = require('electron');

ipcRenderer.on('MTOR', (event, arg) => {
  switch (arg.cmd) {
    case 'log': // 日志事件
      {
        let date = new Date().toString().substr(4, 20);
        app.logData.push({
          time: date,
          order: app.logData.length,
          content: arg.msg.join(' ')
        });
        if (app.logData.length > 1500)
          app.logData.shift();
        break;
      }
    case 'getConfig': // 全局属性
      {
        app.config = arg.data;
        break;
      }
    case 'getAllUID': // 全体userData的UID数组
      {
        arg.data.forEach((uid) => {
          ipcRenderer.send('RTOM', {
            cmd: 'getUserData',
            uid: uid
          });
        });
        break;
      }
    case 'getUserData': // 单个userData
      {
        let tmp = arg.data;
        tmp["uid"] = arg.uid;
        tmp["showItems"] = false;
        tmp["showPassword"] = false;
        if (app.users.length === 0)
          app.users.push(tmp);
        else {
          for (let i = 0; i < app.users.length; i++) {
            if (app.users[i].uid === arg.uid) {
              app.users.splice(i, 1, tmp); // 数组元素替换，配合Vue限制
              return;
            }
          }
          app.users.push(tmp); // 遍历user后未发现同uid, push至数组
        }
        break;
      }
    case 'newUserData': // 新user添加
      {
        let tmp = arg.data;
        tmp["uid"] = arg.uid;
        tmp["showItems"] = false;
        tmp["showPassword"] = false;
        app.users.push(tmp);
        break;
      }
    case 'errorMsg': // 错误提示
      {
        showSnackBar(arg.data);
        break;
      }
    case 'alertMsg': // alert
      {
        showSnackBar(arg.data);
        break;
      }
    case 'captcha': // captcha
      {
        showDialog('验证码', `${arg.uid}\n\n${arg.captcha}`, 'close')
        break;
      }
    case 'sendGiftReturn': // 送礼回显
      {
        showSnackBar(`送礼${arg.success ? '成功' : '失败'}`);
        queryCache('getAllUID');
        app.sendDialog.show = false
        break;
      }
    case 'danmuServerReturn': // 弹幕服务器连接回调
      {
        if (arg.data.connect === true) {
          showSnackBar(`连接弹幕服务器成功`);
          app.danmuServer.connected = true;
          return;
        }
        if (arg.data.connect === false) {
          showSnackBar(`断开弹幕服务器成功`);
          app.danmuServer.connected = false;
          return;
        }
        if (arg.data.danmu !== undefined) {
          if (app.danmuServer.danmuItem.length > 100) app.danmuServer.danmuItem.shift() // 100弹幕限制
          let tmp = {
            user: {
              nickname: arg.data.nickname,
              uid: arg.data.uid,
              vip: arg.data.vip,
              svip: arg.data.svip,
              medalLv: arg.data.medalLv,
              medal: arg.data.medal,
              ul: arg.data.ul,
              rank: arg.data.rank,
              face: arg.data.face
            },
            danmu: arg.data.danmu,
            ts: arg.data.ts
          }
          app.danmuServer.danmuItem.push(tmp);
          if (tmp.user.uid === app.danmuServer.uid) setTimeout(function(){
            app.scrollDanmu();
          }, 500);
        }
        break;
      }
    default:
      return;
  }
});

function generateCommu(head) { // Generates Commu body
  switch (head) {
    case 'getConfig':
      {
        return {
          cmd: head
        };
      }
    case 'getAllUID':
      {
        return {
          cmd: head
        };
      }
    default:
      return;
  }
}

function queryCache(head) { // Triggers ipc sending event.
  ipcRenderer.send('RTOM', generateCommu(head));
}

function showSnackBar(msg) { // SnackBar
  app.snackbar.text = msg;
  app.snackbar.show = true;
}

function showDialog(title, text, shutOption) { // Normal Dialog
  app.dialog.title = title;
  app.dialog.text = text;
  app.dialog.shutOption = shutOption;
  app.dialog.show = true;
}

let app = new Vue({
  el: '#app',
  data: () => ({
    loading: true,
    drawer: null,
    subpages: [
      {
        icon: 'home',
        text: '状态'
      },
      {
        icon: 'notes',
        text: '日志'
      },
      {
        icon: 'computer',
        text: '弹幕'
      }
    ],
    pageTitle: "状态",
    users: [],
    search: "",
    logHeaders: [
      {
        text: "时间",
        description: "该条日志的时间",
        align: "left",
        sortable: false,
        value: "time"
      },
      {
        text: "内容",
        description: "日志原文",
        align: "right",
        sortable: false,
        value: "content"
      }
    ],
    logPagination: {
      sortBy: "order",
      descending: true,
      rowsPerPageItems: [10, 50, {"text":"$vuetify.dataIterator.rowsPerPageAll","value":-1}]
    },
    logData: [],
    danmuServer: {
      uid: 0,
      roomid: 0,
      connected: false,
      danmuItem: [],
      sendMsg: null
    },
    config: {
      defaultUserID: 0,
      listenNumber: 3,
      eventRooms: [3],
      rafflePause: [
        3, 9
      ],
      droprate: 0,
      adminServerChan: ""
    },
    userInfoShow: true,
    searchPanelShow: false,
    logShow: false,
    danmuShow: false,
    settingShow: false,
    snackbar: {
      show: false,
      timeout: 2500,
      text: null
    },
    sendDialog: {
      show: false,
      uid: null,
      giftItem: {
        id: null,
        bagId: null,
        name: null,
        price: 0,
        num: null,
        sendNum: 0,
        sendRoom: 0
      }
    },
    dialog: {
      show: false,
      title: null,
      text: null,
      shutOption: null
    },
    topButtonShow: false
  }),
  methods: {
    bubbleClass: function(danmuUID, UID) { // 动态分配聊天气泡class
      if (danmuUID === UID) return 'right';
      else return 'left'
    },
    clearMessage: function() { // 清空弹幕输入框
      this.danmuServer.sendMsg = null;
      return;
    },
    danmuServerConnect: function() {
      if (!(this.danmuServer.uid >= 0) || this.danmuServer.uid === "") {
        showSnackBar(`UID应为有效值`);
        return;
      }
      if (!(this.danmuServer.roomid > 0)) {
        showSnackBar(`房间号应为有效值`);
        return;
      }
      this.danmuServer.danmuItem = [];
      ipcRenderer.send('RTOM', {
        cmd: 'danmuServerConnect',
        UID: this.danmuServer.uid,
        roomid: this.danmuServer.roomid
      });
    },
    danmuServerDisconnect: function() {
      this.danmuServer.danmuItem = [];
      ipcRenderer.send('RTOM', {
        cmd: 'danmuServerDisconnect',
        roomid: this.danmuServer.roomid
      });
    },
    delUserData: function(uid) { // 发送delUserData事件
      for (let i = 0; i < this.users.length; i++) {
        if (this.users[i].uid === uid)
          this.users.splice(i, 1);
      }
      ipcRenderer.send('RTOM', {
        cmd: 'delUserData',
        uid: uid
      });
    },
    medalColor: function(level) { // 勋章颜色动态class，觉得应该用computed
      if (level === 0)
        return 'lv0'
      else if (level > 0 && level < 5)
        return 'lv1'
      else if (level >= 5 && level < 9)
        return 'lv5'
      else if (level >= 9 && level < 13)
        return 'lv9'
      else if (level >= 13 && level < 17)
        return 'lv13'
      else if (level >= 17 && level <= 20)
        return 'lv17'
    },
    newUserData: function() { // 发送newUserData事件
      ipcRenderer.send('RTOM', {
        cmd: 'newUserData'
      });
    },
    onScroll: function() { // 监听窗体滚动
      let offsetTop = window.pageYOffset;
      if (offsetTop > 250) {
        this.topButtonShow = true;
      } else {
        this.topButtonShow = false;
      }
    },
    scrollDanmu: function() { // 移动弹幕显示到底部
      let div = document.getElementById('danmuContainer');
      div.scrollTop = div.scrollHeight;
    },
    sendGift: function(uid, giftItem) { // 生成送礼Dialog
      this.sendDialog.uid = uid;
      this.sendDialog.giftItem = giftItem;
      this.sendDialog.show = true;
    },
    sendGiftRoom: function(uid, sendItem) { // 向指定房间送礼
      if (sendItem.sendRoom === 0) {
        showSnackBar(`房间号不能为0`);
        return;
      }
      if (sendItem.sendNum > sendItem.num) {
        showSnackBar(`送出礼物不能超出包裹中数量`);
        return;
      }
      ipcRenderer.send('RTOM', {
        cmd: 'sendGiftToRoom',
        uid: uid,
        data: sendItem
      });
    }, //
    sendMessage: function() { // 弹幕发送
      let tmp = this.danmuServer.sendMsg;
      this.clearMessage();
      if (tmp.length === 0) return;
      else if (this.danmuServer.connected !== true) {
        showSnackBar(`未连接弹幕服务器`);
        return;
      }
      else if (this.danmuServer.uid === 0) {
        showSnackBar(`游客UID不能发送弹幕`);
        return;
      }
      ipcRenderer.send('RTOM', {
        cmd: 'sendMessage',
        UID: this.danmuServer.uid,
        roomid: this.danmuServer.roomid,
        msg: tmp
      });
    },
    setConfig: function() { // 发送setConfig事件
      ipcRenderer.send('RTOM', {
        cmd: 'setConfig',
        data: app.config
      });
    },
    setUserData: function(user) { // 发送setUserData事件
      ipcRenderer.send('RTOM', {
        cmd: 'setUserData',
        uid: user.uid,
        data: user
      });
    },
    showAbout: function() { // 显示About
      let msg = [`Bilive_Electron 1.0.6(b20181011)`,
        `基于bilive_client的Electron桌面应用`,
        `Made By Vector000, 请尽情食用吧XD`
      ];
      showDialog('About', msg, 'Close');
    },
    showPages: function(key) { // v-show控制模块显示
      this.pageTitle = key;
      switch (key) {
        case '状态':
          {
            this.userInfoShow = true;
            this.logShow = false;
            this.searchPanelShow = false;
            this.danmuShow = false;
            this.settingShow = false;
            break;
          }
        case '日志':
          {
            this.userInfoShow = false;
            this.logShow = true;
            this.searchPanelShow = true;
            this.danmuShow = false;
            this.settingShow = false;
            break;
          }
        case '弹幕':
          {
            this.userInfoShow = false;
            this.logShow = false;
            this.searchPanelShow = false;
            this.danmuShow = true;
            this.settingShow = false;
            break;
          }
        case '设置':
          {
            this.userInfoShow = false;
            this.logShow = false;
            this.searchPanelShow = false;
            this.danmuShow = false;
            this.settingShow = true;
            break;
          }
        default: break;
      }
    },
    ulColor: function(level) { // 勋章颜色动态class，觉得应该用computed
      if (level >= 0 && level <= 10)
        return 'ul0'
      else if (level >= 11 && level <= 20)
        return 'ul11'
      else if (level >= 21 && level <= 30)
        return 'ul21'
      else if (level >= 31 && level <= 40)
        return 'ul31'
      else if (level >= 41 && level <= 50)
        return 'ul41'
      else if (level >= 51)
        return 'ul51'
    },
    vipStatus: function(vip, svip) { // 老爷状态动态class
      if (vip === 0 && svip === 0)
        return ['vip-gray', '并不是老爷哦']
      else if (vip === 1 && svip === 0)
        return ['vip-color', '是月费老爷哦']
      else
        return ['vip-year-color', '是高贵的年费老爷哦']
    },
  },
  watch: {
    sendDialog: {
      handler: function (val, oldVal) {
        if (val.show === false) {
          this.sendDialog.giftItem.sendNum = 0;
          this.sendDialog.giftItem.sendRoom = 0;
        }
      },
      deep: true
    }
  }
});

setTimeout(function() { // 非常不好的解决方案
  queryCache('getConfig');
  queryCache('getAllUID');
  app.loading = false;
}, 4 * 1000);

setInterval(function() { // 每60s向后端发送更新信息请求
  queryCache('getConfig');
  queryCache('getAllUID');
}, 60 * 1000);
