import { app, BrowserWindow } from 'electron'

if (require('electron-squirrel-startup')) {
  app.quit()
}

let mainWindow: any

const { Menu } = require('electron')

const createWindow = () => {
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false
  })

  mainWindow.setResizable(false)
  mainWindow.setMaximizable(false)

  //mainWindow.openDevTools()

  mainWindow.loadURL(`file://${__dirname}/index.html`)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  });

  mainWindow.on(('show'), () => {
    const BiLive = require(__dirname + '/bilive/index').default
    const bilive = new BiLive()
    bilive.Start()
  })

  mainWindow.on('closed', () => {
    mainWindow = null;
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
})
