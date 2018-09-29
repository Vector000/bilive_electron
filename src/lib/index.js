const {
  ipcRenderer
} = require('electron');

ipcRenderer.on('MTOR', (event, arg) => {
  switch (arg.cmd) {
    case 'log':
      { // 日志事件
        let date = new Date().toString().substr(4, 20);
        app.logData.push({
          time: date,
          content: arg.msg.join(' ')
        });
        if (app.logData.length > 2500)
          app.logData.shift();
        break;
      }
    case 'getConfig':
      { // 全局属性
        app.config = arg.data;
        break;
      }
    case 'getAllUID':
      { // 全体userData的UID数组
        setTimeout(function() {}, 10 * 1000); // 留出时间让userData更新至json
        arg.data.forEach((uid) => {
          ipcRenderer.send('RTOM', {
            cmd: 'getUserData',
            uid: uid
          });
        });
        break;
      }
    case 'getUserData':
      { // 单个userData
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
    case 'newUserData':
      { // 新user添加
        let tmp = arg.data;
        tmp["uid"] = arg.uid;
        tmp["showItems"] = false;
        tmp["showPassword"] = false;
        app.users.push(tmp);
        break;
      }
    case 'errorMsg':
      { // 错误提示
        showSnackBar(arg.data);
        break;
      }
    case 'alertMsg':
      { // alert
        showSnackBar(arg.data);
        break;
      }
    case 'captcha':
      { // captcha
        showDialog('验证码', `${arg.uid}\n\n${arg.captcha}`)
        break;
      }
    default:
      break;
  }
});

function queryCache(head) { // Triggers ipc sending event.
  ipcRenderer.send('RTOM', generateCommu(head));
}

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

function showSnackBar(msg) { // SnackBar
  app.snackbar.text = msg;
  app.snackbar.show = true;
}

function showDialog(title, text, shutOption) { // Dialog
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
    subpages: [{
      icon: 'home',
      text: '状态'
    }, {
      icon: 'notes',
      text: '日志'
    }],
    pageTitle: "状态",
    users: [],
    search: "",
    headers: [{
      text: "时间",
      description: "该条日志的时间",
      align: "left",
      value: "time"
    }, {
      text: "内容",
      description: "日志原文",
      align: "right",
      sortable: false,
      value: "content"
    }],
    logData: [],
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
    settingShow: false,
    snackbar: {
      show: false,
      timeout: 2500,
      text: null
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
    showAbout: function() { // 显示About
      let msg = [`Bilive_Electron 1.0.1(b20180930)`,
        `基于bilive_client的Electron桌面应用`,
        `Made By Vector000, 请尽情食用吧XD`
      ];
      showDialog('About', msg, 'Close');
    },
    showPages: function(key) { // v-show控制模块显示
      switch (key) {
        case '状态':
          {
            this.pageTitle = '状态';
            this.userInfoShow = true;
            this.logShow = false;
            this.searchPanelShow = false;
            this.settingShow = false;
            break;
          }
        case '日志':
          {
            this.pageTitle = '日志';
            this.userInfoShow = false;
            this.logShow = true;
            this.searchPanelShow = true;
            this.settingShow = false;
            break;
          }
        case '设置':
          {
            this.pageTitle = '设置';
            this.userInfoShow = false;
            this.logShow = false;
            this.searchPanelShow = false;
            this.settingShow = true;
            break;
          }
      }
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
    vipStatus: function(vip, svip) { // 老爷状态动态class
      if (vip === 0 && svip === 0)
        return ['vip-gray', '并不是老爷哦']
      else if (vip === 1 && svip === 0)
        return ['vip-color', '是月费老爷哦']
      else
        return ['vip-year-color', '是高贵的年费老爷哦']
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
