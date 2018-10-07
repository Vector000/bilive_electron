# Bilive-Electron
从[bilive_client](https://github.com/vector000/bilive_client)项目(我自己的分支，原作者的主分支在此:[主分支](https://github.com/lzghzr/bilive_client))衍生而来的Electron应用。应用Vue.JS进行前端数据处理，Vuetify作为前端UI框架

## Feature
主要基本与原项目功能一致，本项目采用了Vue+Vuetify，运行日志查找非常方便。而且Vuetify嘛，观感还是不错滴←◡←  
不会用命令行的童鞋可以直接玩儿release  
增添的功能：
* 快速指定直播间送礼
* 主站相关功能

## Releases
Release可以直接下载使用，目前没有做linux包的打算，有兴趣的可以自行编译

## Compile / Installation （编译安装）
1. `git clone`
2. `cd bilive_electron`
3. `npm install`
4. `npm start` 直接运行  
(↓可选↓)
5. `npm run make` 编译为当前平台(win/linux/...)应用，编译生成的程序会在`/out`目录中生成，对应的安装包则位于`/out/make`目录
6. `cd /out/Bilive_Electron-${平台platform}-${架构arch}`
7. `./Bilive_Electron.exe` 在命令行中运行，可直接看到node后端的console

## TO-DO(咕咕咕)
* ~~在前端窗口实现指定直播间送礼~~(已实现)
* 可随意指定房间、登录用户的可交互弹幕姬(long-term)

## Known Issue
* 开始程序时用户数据载入延迟较大(Vuetify的锅，暂时未想到更好的解决方案)
* ~~概率性死鸡~~(应该不会死鸡了233)

## Thanks
* 感谢[lzghzr/bilive_client](https://github.com/lzghzr/bilive_client)
* 感谢[Hochikong](https://github.com/hochikong)带我进了Electron+Vue的坑
* 感谢各种破站api的搜集者
