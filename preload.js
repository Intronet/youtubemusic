/*jslint esnext: true, unused: false, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 3, maxerr: 999*/
/*global $, module, require,  window*/
   
const
  electron = require('electron'),
  {ipcRenderer, remote } = electron,
  {Tray, Menu, dialog} = remote,
  https = require('https'),
  fs = require('fs'),
  Path = require('path'),
  {execFile} = require('child_process'),
  YoutubeMp3Downloader = require("youtube-mp3-downloader"),
  { DownloaderHelper } = require('node-downloader-helper'),
  ytdl = require('ytdl-core'),
  tray = new Tray(Path.join(__dirname, "youtube-music-desktop.ico")),
  trayMenuTemplate = [
    {
      label: 'Music.YouTube',
      enabled: false
    },
    {
      label: 'Play/Pause',
      click: function () {
        $('.play-pause-button').click();
      }
    },
    {
      label: 'Previous song',
      click: function () {
        $('.previous-button').click();
      }
    },
    {
      label: 'Next song',
      click: function () {
        $('.next-button').click();
        }
      },
    ];
let
  downloads =  Path.join(__dirname, "downloads"),
  ffmpegPath =  Path.join(__dirname, "ffmpeg", "ffmpeg.exe"),
  video,
  win,
  videoEvents = {
    onended: (event) => {
      $('#turntable, ytmusic-player#player img#img, #centre').removeClass('playing paused').show();
      $('#loading').attr('show', 'false');
      $(`#main-panel, ytmusic-player-bar`).attr('show', "true");
    },
    onpause: (event) => {
      $('#turntable').addClass('paused').removeClass('playing');
      $('ytmusic-player#player img#img').addClass('paused');
    },
    ondurationchange: (event) => {
      if (getVideo().currentTime === 0) {
        $('#turntable, ytmusic-player#player img#img, #centre').removeClass('playing paused');
        $(`#main-panel, ytmusic-player-bar`).attr('show', "false");
        if($('[player-page-open_]').length){
          $('#loading').attr('show', 'true');
        }
        $('ytmusic-player#player img#img, #centre').hide();
      }
    },
    onplaying: (event) => {
      let
        duration = isNaN(getVideo().duration) ? 0 : getVideo().duration,
        title = 
          $('ytmusic-player-queue-item[selected]').length > 0 ? 
            `${$('ytmusic-player-queue-item[selected] .song-title:eq(0)').text()} • ${$('ytmusic-player-queue-item[selected] .byline:eq(0)').text()}` : 
            `${$('ytmusic-player-queue-item:eq(0).song-title:eq(0)').text()} • ${$('ytmusic-player-queue-item:eq(0).byline:eq(0)').text()}`;
      if (duration === 0) {
        duration = 1;
        console.log('TRAPPED');
        getVideo().currentTime = 0; //99999999999;  
        console.log(`Skipping advert here`);
        getVideo();
        setVideoEvents();
        return false;
      }
      $('ytmusic-player#player img#img, #centre').fadeIn(2500);
      console.log(/*duration,*/`${title}`);
      $('.titlebar span').text(`YouTube Music - [ ${title} ]`);
      $('#turntable').removeClass('paused').addClass('playing');
      $('video, ytmusic-player#player img#img, #centre')
        .addClass('playing').removeClass('paused');
    },
    onloadstart: (event) => {
      $(`#main-panel, ytmusic-player-bar`).attr('show', "false");
      if($('[player-page-open_]').length){
        $('#loading').attr('show', 'true');
      }
      $('ytmusic-player#player img#img, #centre').hide();
      //getVideo().muted=true;
      setTimeout(()=>{
        if($('ytmusic-player-queue-item[selected]').length){
          $('ytmusic-player-queue-item[selected]')[0].scrollIntoView();
        }        
      },1000);
    },
    ontimeupdate: (event) => {
      if (
        ($(`ytmusic-player-bar span.subtitle.ytmusic-player-bar yt-formatted-string.byline:contains("Video will play after ad")`).length > 0) ||
        ($(`ytmusic-player-bar div.middle-controls img.image`).attr('src').includes('https://yt3.ggpht.com')) ||
        ($(`ytmusic-player-bar div.middle-controls span.advertisement[hidden="false"]`).length) ||
        ($(`ytmusic-player-bar[is-advertisement_]`).length)
      ) {
          
          $(`#main-panel, ytmusic-player-bar`).attr('show', "false");
          $('#loading').attr('show', 'true');
          $('ytmusic-player#player img#img, #centre').hide();
          $(`ytmusic-player-bar div.middle-controls img.image`).attr('src', '');
          $(`ytmusic-player-bar span.subtitle.ytmusic-player-bar yt-formatted-string.byline`).text('');
          console.log(`Skipping advert here`);
          /*
          $('.next-button').click();
          $('.previous-button').click();
          */
          getVideo().pause();
          try {getVideo().currentTime = parseInt(getVideo().duration);} catch(e) {}
          window.setTimeout(()=> {getVideo().play();window.setTimeout(()=> {$('body').click();},1);},1);         
          return false;
      }   

      if (getVideo().currentTime <= 0) {
        $(`#main-panel, ytmusic-player-bar`).attr('show', "false");
        if($('[player-page-open_]').length){
          $('#loading').attr('show', 'true');
        }
      }

      if (getVideo().currentTime >= 0.1) {
        $('#loading').attr('show', 'false');
        $(`#main-panel, ytmusic-player-bar`).attr('show', "true");
      }
      if (getVideo().currentTime >= getVideo().duration) {
        $(`#main-panel, ytmusic-player-bar`).attr('show', "false");
        $('#loading').attr('show', 'true');
      }   

    }
  },
  _window = remote.BrowserWindow.getFocusedWindow(),
  getVideo = () => { //  check video is loaded
    video = $('video')[0];
    return video;
  },
  setVideoEvents = () => {
    $(getVideo()).off('loadstart pause playing  timeupdate durationchange')
      .on('loadstart', videoEvents.onloadstart)
      .on('pause', videoEvents.onpause)
      .on('playing', videoEvents.onplaying)
      .on('timeupdate', videoEvents.ontimeupdate)
      .on('durationchange', videoEvents.ondurationchange);
  },
  GetVideoInfo = (videoID, func) => {
    return new Promise(function (resolve, reject) {
      ytdl.getInfo(`${videoID}`, {}, (err, realVideo) => {
        if (err) {
          console.log(err);
          return reject(err);
        }
        resolve(realVideo);
        //console.log(video);
        if (func !== undefined) {
          func(realVideo);
        }
        if (func === undefined) {
          return realVideo;
        }
      });
    });
  },
  trayMenu = Menu.buildFromTemplate(trayMenuTemplate),
  modalWindow = (resizable, width, height, action, props) => {
    win = new remote.BrowserWindow({
      parent: remote.getCurrentWindow(),
      show: false,
      modal: true,
      frame: false,
      action: action,
      props: props,      
      useContentSize:true,
      webPreferences: {
        plugins: true,
        experimentalFeatures: true,
        enableRemoteModule: true,
        nodeIntegration: true,
        webSecurity: false,
        allowRunningInsecureContent: true,
        /*preload: Path.join(__dirname, "preload.js")*/
      },
      resizable: true,
      width: width,
      height: height
    });
    win.loadURL(`file://${__dirname}/modal.html`)
    setTimeout (() => {
      $('*').removeClass('disablePointerEvents');
    },1000);
  };

tray.setContextMenu(trayMenu);
tray.setToolTip('Music.YouTube');

if(!process.execPath.includes(`\\node_modules\\electron\\dist\\electron.exe`)) {
  downloads = `${process.resourcesPath}\\downloads`;
  ffmpegPath = `${process.resourcesPath}\\ffmpeg\\ffmpeg.exe`;
}
//fs.chmodSync(ffmpegPath, 0777);
process.env.FFMPEG_PATH = ffmpegPath;
const
  ffmetadata = require('ffmetadata');
const { windowsStore } = require('process');

 window.onload = () => {
  
  { //  JQUERY
    if ( typeof module === "object" && typeof module.exports === "object" ) {
      //window.jQuery = window.$ = require('jquery');
      window.$ = require('jquery');
    }   
  }

  $(function () {
    { //  extend jQuery
      $.extend($.expr[":"], {
        "contains": function(elem, i, match, array) {
          return (elem.textContent || elem.innerText || "").toLowerCase().indexOf((match[3] || "").toLowerCase()) >= 0;
        }
      });    
    }
    { // IPC sent from modal to mainWindow
      ipcRenderer.on('message', (e, args) => {
        if(args) {
          console.log(args);
         if(args.action === "script") {
          eval(args.script);
         }
        }
      });
    }
    { //  modal scripts
      if (window.location.href.includes("modal.html")) { 
        return false;
      }
    }
    var i = 1; 
    { //  stylesheet       
      $('body')
        .append(`
          <style type="text/css">
            .disablePointerEvents {
              pointer-events: none;
            } 
            .tabs { list-style: none; }
            .tabs li { display: inline; }
            li#downLoadLocation {
              font-size: 1.8em;
              line-height: 1.5em;
              float: right;
              background: #222;
              padding: 0 1.1em;
              cursor:pointer;
              }
            .tabs li a { 
              color: fff; 
              float: left; 
              display: block; 
              padding: 4px 10px; 
              margin-left: -1px; 
              position: relative; 
              left: 1px; 
              text-decoration: none; 
              font-size: 1.6em;
              cursor:pointer;
            }
            .tabs li a:hover { background: #666; color:#fff }

            .tabs li a.active{
              background: #222;
              color:#fff;
            }

            .group:after { visibility: hidden; display: block; font-size: 0; content: " "; clear: both; height: 0; }

            .box-wrap { position: relative; min-height: 250px; }
            /*.tabbed-area div div { background: white; padding: 20px; min-height: 250px; position: absolute; top: -1px; left: 0; width: 100%; }
            .tabbed-area div div, t.abs li a { border: 1px solid #ccc; }*/

            #box-one:target, #box-two:target {
              z-index: 1;
            }            

            ul.tabs.group {
              position: fixed;
              z-index: 999;
              left: 0;
              width: calc(100vw);
              background: #f00;
              box-sizing: border-box;
              padding-left: 32px;
              margin-top: -1px;
            }

            .box-wrap {
              position: fixed;
              height: 1px;
              overflow: hidden;
            }

            .tabbed-area div div {
              background: #222;/*var(--ytmusic-nav-bar-background);*/
              padding: 20px; 
              height: calc(100vh - 124px);
              position: fixed;
              top: 124px;
              left: 0;
              width: 100%;
              overflow:hidden;
              overflow-y: auto;
              margin-bottom: calc(100px - 100vh);
              box-sizing: border-box;
          }            
            #downLoadsMP4 li img{
              border:solid 1px #333;
            }
            [disablePointerEvents]{
              pointer-events: none;
            }    
            * {
              user-select: none;
            }    
            .box-wrap h1{
              text-align:left;
              width: calc(100vw + -13px);
              box-sizing:border-box;
              border-bottom:solid 1px #333;
              padding:0 0 1.0em 50px;
              font-size:2.0em;
              margin: 0 0 0 -19px;
            }
            .titlebar {
              display: block;
              position: fixed;
              height: 32px;
              padding: 0;
              top: 0;
              width: 100%;
              background-color: rgb(63, 63, 63);
            }
            .titlebar span {
              display: inline-block;
              margin: 5px 0 0 10px;
              font-family: var(--ytmusic-title-1_-_font-family);
              color: #fff;
              font-size: 1.8em;
            }
            .resizer {
              background: transparent;
              position: fixed;
              left: 0;
              top: 0;
              height: 6px;
              width: 100%;
              z-index: -1;
              -webkit-app-region: no-drag;
            } 
            .titlebar.draggable
            {
                -webkit-app-region: drag;
            }
            .titlebar-controls
            {
                float: right;
                text-align: left;
            }
            .titlebar:after,
            .titlebar-controls:after
            {
                content: ' ';
                display: table;
                clear: both;
            }
            .titlebar-minimize,
            .titlebar-resize,
            .titlebar-close
            {
                float: left;
                width: 45px;
                height: 31px;
                margin: 1px 1px 0 0;
                text-align: center;
                line-height: 29px;
                -webkit-transition: background-color .2s;
                -moz-transition: background-color .2s;
                -ms-transition: background-color .2s;
                -o-transition: background-color .2s;
                transition: background-color .2s;
            }
            .titlebar.draggable .titlebar-minimize,
            .titlebar.draggable .titlebar-resize,
            .titlebar.draggable .titlebar-close
            {
                -webkit-app-region: no-drag;
            }
            .titlebar-minimize svg,
            .titlebar-resize svg.maximize-svg,
            .titlebar-resize svg.fullscreen-svg,
            .titlebar-close svg
            {
                width: 10px;
                height: 10px;
                shape-rendering: crispEdges;
            }
            .titlebar-close svg polygon
            {
                -webkit-transition: fill .2s;
                -moz-transition: fill .2s;
                -ms-transition: fill .2s;
                -o-transition: fill .2s;
                transition: fill .2s;
            }
            .titlebar:not(.fullscreen) svg.maximize-svg
            {
                display: none;
            }
            .titlebar.fullscreen svg.fullscreen-svg
            {
                display: none;
            }
            .titlebar-minimize:hover,
            .titlebar-resize:hover,
            .titlebar-fullscreen:hover
            {
                background-color: rgba(255, 255, 255, 0.1);
            }
            .titlebar-light .titlebar-minimize:hover,
            .titlebar-light .titlebar-resize:hover,
            .titlebar-light .titlebar-fullscreen:hover
            {
                background-color: rgba(0, 0, 0, 0.1);
            }
            .titlebar-close:hover
            {
                background-color: rgba(232, 17, 35, 0.9);
            }
            .titlebar-close:hover svg polygon
            {
                fill: rgba(255, 255, 255, 1);
            }
            .titlebar-light .titlebar-close:hover
            {
                fill: rgba(0, 0, 0, 1);
            }
            .titlebar-light svg polygon,
            .titlebar-light svg rect,
            .titlebar-light svg > path
            {
                fill: rgba(255, 255, 255, 1);
            }
            .titlebar-light .titlebar-close:hover
            {
                background-color: rgba(232, 17, 35, 0.9);
            } 
            #downLoadsFrame {
              opacity: 1 !important;
              top: 97px !important;
              height: 100px;
              overflow: hidden;
              display: none;
              color: #fff;
              text-align: center;
              box-sizing: border-box;
              padding: 0 0 25px 0;
              position: fixed;
              background: var(--ytmusic-nav-bar-background);
              left: 0;
              z-index: 3;
              width: 100%;         
            } 
            .downLoadsList{
              margin:0;
              padding:0;
              display: flex;
              flex-wrap: wrap;
              list-style:none;
              justify-content: center;
            }
            .downLoadsList li{
              width: 200px;
              height: 290px;
              list-style:none;
              /*outline: dotted 1px #222;*/
              margin: 20px 0 0 30px;
              position:relative;
            }
            #downLoadsMP4 li{
              width:280px;
              height:280px;
            }
            .downLoadsList img{
              width:100%;
              cursor:pointer;
            }
            #downLoadsMP3 img{
              height:200px;
            }
            .downLoadsList .title{
              position:relative;
              top:5px;
              width:100%;
              font-size:1.3em;
            }
            div#editTag {
              background: var(--ytmusic-nav-bar-background);
              color: #fff;
              width: 600px;
              min-height: 540px;
              z-index: 6;
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              text-align: center;
              padding: 1.0em 1.5em 1.3em;
              font-size: 1.4em;
              border-radius: 0.2em;
              border: solid 1px #333;
              display:none;
            }
            div#editTag audio {
              height: 25px;
              width: 99%;
              outline: solid 1px;
              background: #fff;
            }
            div#editTag img{
              height:190px;
              margin:10px;
            }
            div#editTag .btns{
              text-align: right;
              margin: 18px 0 0 0;
            }
            div#editTag .btns button{
              padding:0.5em;
              border-radius:3px;
              border:none;
              margin:0 0 0 5px;
              font-size: 1.01em;
              background-color: #333;
              color:#fff
            }
            div#editTag .btns button:hover{
              background-color: #f00;
              color:#fff
            }
            div#editTag table{
              width:100%;
              -webkit-border-vertical-spacing: 10px;
              text-align: left;
              margin:0 0 10px 0
            }
            div#editTag table td{
              border: solid 1px #333;
              padding: 5px;
              text-align:center;
            }
            div#editTag #selection{
              width:100%;
              margin:10px 0 0 0;
              background-color: #333;
              color:#fff ;
              padding:0.5em;
              box-sizing:border-box;   
              border-radius: 0.2em;
              border: solid 1px #4f4f4f;         
            }
            div#editTag table td input{
              width: 100%;
              border: none;
              background: #333;
              color: #fff;
              padding:0.3em;
              box-sizing:border-box;
              text-align:left;
            }
            #downLoadDialog{
              display:none;
            }
            div#downLoadDialog.error #downLoadProgress {
              background: #c00;
            }
            div#downLoadBlanker,#downLoadsFrame {
              position: fixed;
              background: #222; /*var(--ytmusic-nav-bar-background);*/
              left: 0;
              top: 33px;
              z-index: 3;
              width: 100%;
              height: 100%;
              opacity: 0.5;
            }
            .download-close {
              width: 12px;
              padding: 4px;
              position: relative;
              float: right;
              margin: -12px -39px 0 0;
            }   
            .download-close:hover
            {
                background-color: rgba(232, 17, 35, 0.9);
            }

            .download-close:hover svg polygon
            {
                fill: rgba(255, 255, 255, 1);
            }                     
            div#downLoadProgress {
              background: var(--ytmusic-nav-bar-background);
              color: #fff;
              width: auto;
              z-index: 6;
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              text-align: center;
              padding: 1.0em 3.0em 1.3em;
              font-size: 1.4em;
              border-radius: 0.2em;
              border: solid 1px #333;
            }
            div.downloadProgress {
              background: rgb(243, 63, 63);
              height: 20px;
              width: 100%;
              margin: 1.0em 0 0 0;
            }
            div.downLoadTitle{
              white-space: nowrap;
            }
            div.downLoadDownloaded {
              background: #fff;
              width: 42%;
              height: 100%;
              color: #c00;
              line-height: 1.5em;
              text-align:left;
              padding-left:0.3em;
            }
            ytmusic-player-queue-item[selected] {
              background:#3f3f3f;
            }
            #player-bar-background.ytmusic-app-layout {
              right:19px !important;
            }
            [player-page-open_] #player-bar-background.ytmusic-app-layout {
              right:0px !important;
            }
            body{
              overflow: hidden !important;
            }           
            div#ytmusic-app {
              display: inline-block;
              margin: 97px 0 0 0;
              overflow:auto;
              width:100%;
              height: calc(100vh - 97px);
            }
            ytmusic-app{
              margin: -36px 0 0 0;
            }
            /*div#ytmusic-app::-webkit-scrollbar, #downLoadsFrame*/::-webkit-scrollbar  {
              width: 13px; /*var(--ytmusic-scrollbar-width);*/
              border-left: solid 1px #222;
            }
            /*div#ytmusic-app::-webkit-scrollbar-thumb, #downLoadsFrame*/::-webkit-scrollbar-thumb {
              background-color: #333; /*var(--ytmusic-color-grey-9);*/
            }               
            ytmusic-app-layout > [slot="nav-bar"], #nav-bar-background.ytmusic-app-layout {
              top: 32px;
            }
            #nav-bar-background.ytmusic-app-layout {
              opacity: 1;
            }
            ytmusic-player-queue#queue {
                margin: 0 0 0 35px;
            }
            .top-bar.ytmusic-player-page {
                margin: 0 17px 0 35px;
            }
            .side-panel.ytmusic-player-page {
                /*width: calc(var(--ytmusic-player-page-side-panel-width) + 45px);*/
                /*margin:0 0 0 60px;*/
            }
            /*div#contents*/ ytmusic-player-queue#queue {
              padding-bottom: calc(100vh - 450px);
              /*margin: 0 0 0 13px;*/
            }
            ytmusic-player-queue-item.style-scope.ytmusic-player-queue {
              /*left: -36x !important;*/
            }
            div#contents {
              position: relative;
              left: -36px;
            }
            .description.ytmusic-description-shelf-renderer{
              position:relative;
              left:36px;
            }
            /*.non-expandable.description.style-scope.ytmusic-description-shelf-renderer{

            }*/

            .immersive-background.ytmusic-immersive-carousel-shelf-renderer {
                /*position: fixed;
                opacity: 0.3;*/
            }
            #automix-contents.ytmusic-player-queue {
              opacity: 1 !important;
              /*pointer-events: all !important;*/
            }
            ytmusic-player[player-ui-state_="MINIPLAYER"] {
                position: fixed;
                top: calc(-100% - 95px);
                right: 64px;
            }
            .content.ytmusic-player-page {
                padding-right: 20px;
            }
            div#loading {
                position: fixed;
                left: calc(100% - 68.6%);
                top: calc(100% - 50.5%);
                zoom: 0.7;
            }
            @media (max-width: 935px) {
              div#loading {
                left: calc(100% - 49.6%);
                top: calc(100% - 65.5%);
              }
            }
            div#main-panel, ytmusic-player-bar, #loading {
              visibility:hidden;
            }
            [show="false"] {
              visibility:hidden !important;
            }
            [show="true"] {
              visibility:visible !important;
            }
            .videoAdUi,
            div.video-ads,
            div.ytp-ad-persistent-progress-bar-container,
            .ytp-paid-content-overlay, 
            ytmusic-mealbar-promo-renderer,
            .ytp-cards-teaser {
              opacity:0 !important;
              visibility: hidden !important;
              display:none !important;
            }
            div#centre {
              width: 40px;
              height: 40px;
              background: #131313;
              border-radius: 30px;
              position: absolute;
              margin: -53.5% 46.5%;
              border: double 6px #777;
              display:none;
            }
            [player-ui-state_="MINIPLAYER"] div#centre,
            [player-ui-state_="FULLSCREEN"] div#centre { 
              display:none !important;
            }  
            @-webkit-keyframes spin {
              0%  {-webkit-transform: rotate(0deg);}
              100% {-webkit-transform: rotate(360deg);}	
            }
            img#img.cd{
              border-radius:400px;
              border:solid #444;
              box-sizing: border-box;
              display:none;
            }
            img#img.cd.playing{
              -webkit-animation: spin 4s infinite linear;
            }
            img#img.cd.playing.paused{
              -webkit-animation-play-state: paused;
            }
            ytmusic-player#player{
              background : transparent;
            }
            .html5-video-container {
              display: flex;
              justify-content: center;
            }
            img#turntable{
              position: absolute;
              right: 0px;
              width: calc(var(--ytmusic-player-page-side-panel-width) + 10px);
              height: calc(100% + 1px);
              opacity: 0.2;
              border: none;
              outline: none;
            }
            img#turntable.playing{
              /* background: url(http://vinylgif.com/gifs/201412/ai-monogatari---9-love-stories-vinyl.gif); */
              /* background: url(http://vinylgif.com/gifs/201412/cartridge-sinning-vinyl.gif); */
              background: url(http://vinylgif.com/gifs/201411/spinning-blue-vinyl.gif);
              /* background: url(http://vinylgif.com/gifs/201411/parlophone-vinyl-spinning.gif); */
              /* background: url(http://vinylgif.com/gifs/201411/spinning-vinyl-4.gif); */
              /* background: url(http://vinylgif.com/gifs/201411/spinning-vinyl-88.gif); */
              /* background: url(http://vinylgif.com/gifs/201411/stax-record-spinning.gif); */
              /* background: url(http://vinylgif.com/gifs/201411/vinyl-786.gif); */
              /* background: url(http://vinylgif.com/gifs/201411/spinning-vinyl-43.gif); */ 
              background-size:cover;
              background-repeat:no-repeat;
              background-position: calc(var(--ytmusic-player-page-side-panel-width) - 660px) 0;
            }
            img#turntable.paused {
              background:none;
            }
            *:not(ytmusic-player-bar).SelectedItem{
              background-color:var(--ytmusic-color-grey-9) !important;
            }
            #downloads {
              font-family: var(--ytmusic-title-1_-_font-family);
              font-size: var(--ytmusic-title-1_-_font-size);
              font-weight: var(--ytmusic-title-1_-_font-weight);
              color: var(--ytmusic-title-1_-_color);
              --yt-endpoint-color: var(--ytmusic-title-1_-_--yt-endpoint-color);
              --yt-endpoint-hover-color: var(--ytmusic-title-1_-_--yt-endpoint-hover-color);
              --yt-endpoint-visited-color: var(--ytmusic-title-1_-_--yt-endpoint-visited-color);
              display: inline-flex;
              align-items: center;
              color: var(--ytmusic-inactive-tab-color);
              cursor: pointer;
            }
            #downloads:hover span, #downloads.active span{
              color:#fff !important;
            }
            button.ytp-large-play-button.ytp-button {
              display:none !important;
            }          
            .middle-controls.ytmusic-player-bar {
              position: relative;
              margin: 5px 0 0 0;
              align-items: left;
              justify-content: left;
            }
            yt-formatted-string.title.style-scope.ytmusic-player-bar {
              font-size: 2.3em !important;
              position: relative;
              margin: 0 0 0 0;
            }
            div.download{
              padding: 10px 15px !important;margin:0 !important;cursor:pointer;text-decoration:none;color:#fff;
            }
            div.download icon{
              transform: rotate(270deg); margin: 0 5px 0 0 !important;display:inline-block;width:24px;vertical-align:middle;
            }
            div.download icon svg{
              pointer-events: none; display: block; width: 100%; height: 100%;
            }
            div.download span{
              margin: var(--ytmusic-menu-item-text_-_margin);
            }
            div.download:hover {
              background-color: var(--ytmusic-menu-item-hover-background-color);
            }
            ytmusic-menu-popup-renderer{
              max-width: unset !important;
              max-height: unset !important;
            }
            </style>`);
    }  
    { //  mousedown - select queue item - more actions - download
      $('*').on('mousedown', (event) => {
        { //  mp3/mp4 tabs switcher
          if ($(event.target).is(`.tabs li a`)) {
            $('.tabs li a').removeClass('active');
            $(event.target).addClass('active');
          }
        }
        { // show downloads
          if ($(event.target).is('.tab-title.style-scope.ytmusic-pivot-bar-item-renderer')) {
            $(`.tab-title.style-scope.ytmusic-pivot-bar-item-renderer`).removeClass('active');
            $(event.target).addClass('active');            
            if($(event.target).text()!="Downloads"){
              $('#downloads').removeClass('active');
              $('#downLoadsFrame').hide();
            } else {
              if($(event.target).text()==="Downloads"){
                event.stopPropagation();
              }
              if($('#downloads.active').length){
                $('#downloads').removeClass('active');
                $('#downLoadsFrame').hide();
                $('._iron-selected').addClass('iron-selected').removeClass('_iron-selected');
                return false;
              }
              $('#downloads').addClass('active');
              $('.iron-selected').removeClass('iron-selected').addClass('_iron-selected');
              $('#downLoadsFrame').html(`
                <div class="tabbed-area">
                  <ul class="tabs group">
                    <li><a class="active" data-href="#box-one">MP3 Audio</a></li>
                    <li><a data-href="#box-two">MP4 Videos</a></li>
                    <li id="downLoadLocation">${downloads}</li>
                  </ul>
                  <div class="box-wrap">
                    <div id="box-two">
                      <h1>MP4 Videos</h1>
                      <ul class="downLoadsList" id="downLoadsMP4"/>
                    </div>
                    <div id="box-one">
                      <h1>MP3 Audio</h1>
                      <ul class="downLoadsList" id="downLoadsMP3"/>
                    </div>
                  </div>
                </div>
              `).show(); 
              $('.tabs.group li a').off().on('click', (event) =>{
                $( $(event.target).data('href') ).fadeIn();
                $('.box-wrap div[id]').not(`${$(event.target).data('href')}`).hide()
              });
              fs.readdir(downloads, function (err, files) {
                if (err) {  //  handling error
                    return console.log('Unable to scan directory: ' + err);
                } 
                files.sort();
                files.forEach(function (file, i) {
                  if (file.includes('.mp3')) { //  MP3
                    ffmetadata.read(`${downloads}/${file}`, function(err, data) {
                      if (err) {
                        //console.log("Error reading metadata", err);
                        process.chdir('downloads');
                        fs.unlink(file, err => {
                          if(err){
                            console.log('Error', err);
                          }
                        });
                        process.chdir('../');
                        return false;                        
                      } else {
                        if(!data.thumbnail) {
                          process.chdir('downloads');
                          fs.unlink(file, err => {
                            if(err){
                              console.log('Error', err);
                            }
                          });
                          process.chdir('../');
                          return false; 
                        }
                        $('#downLoadsFrame ul#downLoadsMP3').append(`
                          <li data-position="${i}">
                            <img id="song_${i}" title="click to [play/delete/edit/] MP3 tags" filename="${downloads}\\${file}" alt="${file}" src="${data.thumbnail}">
                            <div class="title">${file.replace('.mp3','').replace('[','<br><small>').replace(']','</small>')}</div>
                          </li>
                        `); 
                        $("ul#downLoadsMP3").each(function(){
                          $(this).html($(this).children('li').sort(function(a, b){
                              return ($(b).data('position')) < ($(a).data('position')) ? 1 : -1;
                          }));
                        });                      
                      }
                    });              
                  } else { //  MP4
                    var 
                      thumbnail = `https://i.ytimg.com/vi/${localStorage.getItem(file)}/hqdefault.jpg`
                      $('#downLoadsFrame ul#downLoadsMP4').append(`
                        <li data-position="${i}">
                          <img id="song_${i}" title="click to [view/delete] Video" filename="${downloads}\\${file}" alt="${file}" src="${thumbnail}">
                          <div class="title">${file.replace('.mp4','').replace('[','<br><small>').replace(']','</small>')}</div>
                        </li>
                      `); 
                    $("ul#downLoadsMP4").each(function(){
                      $(this).html($(this).children('li').sort(function(a, b){
                          return ($(b).data('position')) < ($(a).data('position')) ? 1 : -1;
                      }));
                    });                      
                  }
                }); 
              }); 
              {
                $('#downLoadLocation').on('click', (event) => {
                  execFile('explorer', [downloads]);
                });
              }
              { //  search filter
                $('.search-box input#input').on('input.myfilter', function () {
                  let
                    value = $(this).val().toLowerCase();
                  if (!value.length) {
                    $('.downLoadsList li').show();      
                    return false;
                  }
                  $('.downLoadsList li').not(`:contains(${value})`).hide();
                  $(`.downLoadsList li:contains(${value})`).show();
                });
                $('.search-box paper-icon-button#clear, .search-box iron-icon#icon').on('click.myfilter', function () {
                  $(`.downLoadsList li`).show();
                });
              }
            }
          }      
        }       
        { //  mp3 popup menu
          if ($(event.target).closest('#downLoadsFrame #downLoadsMP3 img').length) {
            event.stopPropagation(); 
            var
              downloadItem = $(event.target).parent(),
              filename = $(downloadItem).find('img').attr('filename'),
              template = [
                { // Play MP3
                  label: 'Play',
                  /*icon: path.join(__dirname, `/icons/play-button.png`),*/
                  click: function () {
                    modalWindow(false, 0, 0, 'media', 
                      [
                        {
                          filename : filename
                        }
                      ]);
                  }
                },
                { //  Edit MP3 tags
                  label: 'Edit MP3 tags',
                  /*icon: path.join(__dirname, `/icons/play-button.png`),*/
                  click: function () {
                    modalWindow(false, 0, 0, 'editTags', 
                      [
                        {
                        "id" : $(event.target).attr('id'), 
                        "title" : $(event.target).attr('alt'),
                        "filename" : $(event.target).attr('filename'),
                        "image" : $(event.target).attr('src'),
                        }
                      ]);                              
                  }
                },
                { //  Delete MP3
                  label: 'Delete',
                  /*icon: path.join(__dirname, `/icons/play-button.png`),*/
                  click: function () {
                    fs.unlink(filename, err => {
                      if(err){
                        console.log('ERROR', err);
                      }
                      $(downloadItem).remove();
                    });
                  }
                }               
              ],
              context = Menu.buildFromTemplate(template);
            context.popup(_window); 
          }
        }
        { //  mp4 popup menu
          if ($(event.target).closest('#downLoadsFrame #downLoadsMP4 img').length) { 
            event.stopPropagation();
            var
              downloadItem = $(event.target).parent(),
              filename = $(downloadItem).find('img').attr('filename'),
              template = [
                { // Play MP4
                  label: 'Play',
                  /*icon: path.join(__dirname, `/icons/play-button.png`),*/
                  click: function () {
                    modalWindow(true, 0, 0, 'media', 
                      [
                        {
                          filename : filename
                        }
                      ]);                    
                  }
                },
                { //  Delete MP4
                  label: 'Delete',
                  /*icon: path.join(__dirname, `/icons/play-button.png`),*/
                  click: function () {
                    fs.unlink(filename, err => {
                      if(err){
                        console.log('ERROR', err);
                      }
                      $(downloadItem).remove();
                      localStorage.removeItem(`${$(downloadItem).find('img').attr('alt')}`);
                    });
                  }
                }  
              ],
              context = Menu.buildFromTemplate(template);
            context.popup(_window);
          }
        }
        { //  play button
          if ($(event.target).closest('#play-button').length) {
            $(`#main-panel, ytmusic-player-bar`).attr('show', "false");
            if($('[player-page-open_]').length){
                $('#loading').attr('show', 'true');
            }
            $('ytmusic-player#player img#img, #centre').hide();
            return;
          }
        }  
        { //  download mp3/mp4
          let
            closest;
          if ($(event.target).closest('ytmusic-player-queue-item').length) {
            closest = `ytmusic-player-queue-item`;
          } else if ($(event.target).closest('ytmusic-responsive-list-item-renderer').length) {
            closest = `ytmusic-responsive-list-item-renderer`;
          } else if ($(event.target).closest('ytmusic-list-item-renderer').length) {
            closest = `ytmusic-list-item-renderer`;
          } else if ($(event.target).closest('ytmusic-player-bar').length) {
            closest = `ytmusic-player-bar`;
          } 
          $(closest).removeClass('SelectedItem');
          let
            selected = $(event.target).closest(closest),
            moreActions = () => {
              window.setTimeout(() => {
                if (!$(`paper-listbox #downloadMP4`).length) {
                  $('paper-listbox').hide().prepend(`
                      <div id="downloadMP4" 
                        class="download text style-scope ytmusic-menu-service-item-renderer">
                        <icon class="icon style-scope ytmusic-menu-service-item-renderer">
                          <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="style-scope iron-icon">
                            <g class="style-scope iron-icon"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" class="style-scope iron-icon"></path></g>
                          </svg>
                        </icon>
                        <span>Download mp4</span>
                      </div>
                      <div id="downloadMP3" 
                        class="download text style-scope ytmusic-menu-service-item-renderer">
                        <icon class="icon style-scope ytmusic-menu-service-item-renderer">
                          <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="style-scope iron-icon">
                            <g class="style-scope iron-icon"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" class="style-scope iron-icon"></path></g>
                          </svg>
                        </icon>
                        <span>Download mp3</span>
                      </div>`).show();
                  $('iron-dropdown').css('top', `${parseInt($('iron-dropdown').css('top')) - 50}px`);
                  $('.download').on('click', (event) => {
                    $('*').addClass('disablePointerEvents');
                    let
                      dest,
                      title,
                      media,
                      songtitle,
                      artist,
                      videoInfo = $(`a:contains('Start radio')`).attr('href').match(/watch\?v=(.*?)$/),
                      videoId = videoInfo[1].replace(/&list=(.*?)$/, ''),
                      videoPlayList = videoInfo[1].replace(/(.*?)&list=/, ''),
                      url = `https://www.youtube.com/watch?v=${videoId}&list=${videoPlayList}`;

                      $('body').click();
                      if($(selected).is('ytmusic-responsive-list-item-renderer')){
                          songtitle = $(selected).find('yt-formatted-string.title:eq(0)').text(); 
                          artist = $(selected).find('yt-formatted-string.flex-column:eq(0)').text(); 
                          if($(selected).find('div.secondary-flex-columns yt-formatted-string.flex-column:eq(1) a').length){
                            artist = `${artist} • ${$(selected).find('div.secondary-flex-columns yt-formatted-string.flex-column:eq(1) a').text()}`;
                          }
                      } else if($(selected).is('ytmusic-player-queue-item')){
                          songtitle = $(selected).find('yt-formatted-string.song-title:eq(0)').text();
                          artist = $(selected).find('yt-formatted-string.byline:eq(0)').text();
                      } else if($(selected).is('ytmusic-list-item-renderer')){
                          songtitle = $(selected).find('div.title:eq(0)').text(); 
                          artist = `${$('#header div.byline yt-formatted-string a:eq(0)').text()} • ${$('#header h2.title:eq(0)').text()}`;
                      } else if($(selected).is('ytmusic-player-bar')){
                          songtitle = $(selected).find('yt-formatted-string.title:eq(0)').text();
                          artist = $.trim($(selected).find('.byline-wrapper:eq(0) .subtitle').text()).split('•');
                          artist = `${$.trim(artist[0])} • ${$.trim(artist[1])}`;// • ${$.trim(artist[2])}`;
                          if($(selected).find('.byline-wrapper:eq(0) .subtitle .byline[title*=" views • "]').length){
                            console.log('RETITLE');
                            artist = $(selected).find('.byline-wrapper:eq(0) a:eq(0)').text();
                          }
                      }
                    title = `${songtitle} [${artist}]`.replace(/\//g,'\\').replace(/&/g,'＆').replace(/\?/g,'？').replace(/"/g,'″');
                    media = $(event.target).closest('#downloadMP4').length ? '.mp4' : '.mp3';
                    dest = `${downloads}/${title}${media}`;
                     
                    if(media === '.mp4'){
                      modalWindow(true, 0, 0, 'downloadMedia', 
                      [
                        {
                        "type" : "video",
                        "url" : url, 
                        "filename" : `${title}${media}`,
                        "videoID" : videoId
                        }
                      ]); 
                    }  
                    if(media === '.mp3'){
                      modalWindow(true, 0, 0, 'downloadMedia', 
                      [
                        {
                          "type" : "audio",
                          "url" : url, 
                          "filename" : `${title}${media}`,
                          "videoID" : videoId,
                          "thumbnail" : 'realVideo.player_response.videoDetails.thumbnail.thumbnails[3].url',
                          "artist" : artist,
                          "album" : artist,

                        }
                      ]);
                    } 
                    return;
                  });
                }
              });
            };
          $(selected)
            .addClass('SelectedItem')
            .off('contextmenu')
            .on('contextmenu', (event) => {
              moreActions();
            })
            .find('paper-icon-button').on('mousemove mousedown mouseup mouseenter mouseover click pointermove pointerdownn pointerup pointerenter pointerover pointerclick', (event) => {
              moreActions();
            });
        }
      });
    }     
    { //  back/next
      $(window)
        .on('keydown', (event) => {
          if (event.shiftKey && event.which == 38) { //ctrlKey
            $('.previous-button').click();
          } else if (event.shiftKey && event.which == 40) {
            $('.next-button').click();
          }
        });

      $('.previous-button, .next-button')
        .on('click', (event) => {
          $(`#main-panel, ytmusic-player-bar`).attr('show', "false");
          if($('[player-page-open_]').length){
              $('#loading').attr('show', 'true');
          }
          $('ytmusic-player#player img#img, #centre').hide();
        });
    }
    { //   setInterval
      window.setInterval(() => { 
        { // attach video events 
          if( $(getVideo()).length) {
            if (!video.onpause){
              setVideoEvents();
            }
          }
        }
        { //  adblock
          if (
            ($(`ytmusic-player-bar span.subtitle.ytmusic-player-bar yt-formatted-string.byline:contains("Video will play after ad")`).length > 0) ||
            ($(`ytmusic-player-bar div.middle-controls img.image`).length && $(`ytmusic-player-bar div.middle-controls img.image`).attr('src').includes('https://yt3.ggpht.com')) ||
            ($(`ytmusic-player-bar div.middle-controls span.advertisement[hidden="false"]`).length)
          ) {
              
              $(`#main-panel, ytmusic-player-bar`).attr('show', "false");
              $('#loading').attr('show', 'true');
              $('ytmusic-player#player img#img, #centre').hide();
              $(`ytmusic-player-bar div.middle-controls img.image`).attr('src', '');
              $(`ytmusic-player-bar span.subtitle.ytmusic-player-bar yt-formatted-string.byline`).text('');
              //console.log(`Skipping advert here ####`);
              //getVideo().pause();
              //getVideo().currentTime = 999999999999999999999;
              //return false;
          }        
        }     
        { //  no disturb
          if($('ytmusic-you-there-renderer #button').length){ 
            console.log('Are you there');
            $('ytmusic-you-there-renderer #button').click();
            $('ytmusic-popup-container').remove();
            /*setTimeout(()=>{$('ytmusic-you-there-renderer #button').click();});*/
          }
        }         
        { //  insert new app container
          if(!$('#ytmusic-app').length){
            $('ytmusic-app').wrapAll( "<div id='ytmusic-app' />");
            $('body').append(`
            <div id="downLoadDialog">
              <div id="downLoadBlanker"></div>
              <div id="downLoadProgress">
                <div class="download-close">
                  <svg x="0px" y="0px" viewBox="0 0 10 10">
                      <polygon fill="#000000" points="10,1 9,0 5,4 1,0 0,1 4,5 0,9 1,10 5,6 9,10 10,9 6,5" style="fill: rgb(255, 255, 255);"></polygon>
                  </svg>
                </div>              
                  <div class="downLoadTitle">Stupid Is As Stupid Does.mp3</div>
                  <div class="downloadProgress">
                      <div class="downLoadDownloaded"></div>
                  </div>
              </div>
            </div>
            <div id="downLoadsFrame"></div>
            `);
          }
        }        
        { //  nav downloads link
          if(!$('div#downloads').length){
            $('ytmusic-pivot-bar-renderer').append(`
                <div id="downloads" class="style-scope ytmusic-pivot-bar-renderer" tab-id="FEmusic_downloads" role="tab">
                  <span style="color: rgba(255, 255, 255, .5);font-size:20px;" class="tab-title style-scope ytmusic-pivot-bar-item-renderer">Downloads</span>
                </div>    
              `); 
          }
        }        
        { //  turntable
          if(!$('img#turntable').length){
            $('#main-panel').prepend(`<img id="turntable" />`);
          }
        }        
        { //  cd
          if ($('video').attr('src')) { /*$ !== undefined && */
            $('video')
              .removeAttr('controlslist webkit-playsinline playsinline')
              .removeClass('video-stream html5-main-video');
            if ($('ytmusic-player#player').width() == $('ytmusic-player#player').height()) {
              $('ytmusic-player#player, ytmusic-player#player img#img').addClass('cd');
            } else {
              $('ytmusic-player#player, ytmusic-player#player img#img').removeClass('cd');
            }
          }
        }       
        { //  cd hole
          if (!$('div#centre').length) {
            $('ytmusic-player#player #song-image').append(`
              <div id="centre" class=""></div>
            `);
          }
        }        
        { //  loading
          if (!$('#loading').length) {
            $('ytmusic-app').append(`
              <div id="loading">
              <div class="ytp-spinner"><div class="ytp-spinner-container"><div class="ytp-spinner-rotator"><div class="ytp-spinner-left"><div class="ytp-spinner-circle"></div></div><div class="ytp-spinner-right"><div class="ytp-spinner-circle"></div></div></div></div><div class="ytp-spinner-message" style="display: none;">If playback doesn't begin shortly, try restarting your device.</div></div>
              </div>
            `);
          }
        }       
        { //  add title to titleBar
          if($('iron-a11y-announcer').length && !$('.titlebar span').length){
            { // tilebar HTML
              $('body').append(`
              <div class="titlebar draggable" style="background-color: rgb(63, 63, 63);"><div class="resizer"></div><span>YouTube Music</span>
                  <div class="titlebar-controls">
                      <div class="titlebar-minimize">
                          <svg viewBox="0 0 10 1">
                              <rect x="0px" y="0px" fill="#000000" width="10" height="1" style="fill: rgb(255, 255, 255);"></rect>
                          </svg>
                      </div>
                      <div class="titlebar-resize">
                          <svg class="fullscreen-svg" viewBox="0 0 10 10">
                              <path x="0px" y="0px" fill="#000000" d="M 0 0 L 0 10 L 10 10 L 10 0 L 0 0 z M 1 1 L 9 1 L 9 9 L 1 9 L 1 1 z " style="fill: rgb(255, 255, 255);"></path>
                          </svg>
                          <svg class="maximize-svg" viewBox="0 0 10 10">
                              <mask id="Mask" x="0px" y="0px">
                                  <rect fill="#FFFFFF" width="10" height="10"></rect>
                                  <path fill="#000000" d="M 3 1 L 9 1 L 9 7 L 8 7 L 8 2 L 3 2 L 3 1 z"></path>
                                  <path fill="#000000" d="M 1 3 L 7 3 L 7 9 L 1 9 L 1 3 z"></path>
                              </mask>
                              <path fill="#FFFFFF" d="M 2 0 L 10 0 L 10 8 L 8 8 L 8 10 L 0 10 L 0 2 L 2 2 L 2 0 z" mask="url(#Mask)"></path>
                          </svg>
                      </div>
                      <div class="titlebar-close">
                          <svg viewBox="0 0 10 10">
                              <polygon x="0px" y="0px" fill="#000000" points="10,1 9,0 5,4 1,0 0,1 4,5 0,9 1,10 5,6 9,10 10,9 6,5" style="fill: rgb(255, 255, 255);"></polygon>
                          </svg>
                      </div>
                  </div>
              </div>
              `);
            }  
            /** Event#Close */
            $('.titlebar .titlebar-close').on('click', (event) => {
              dialog.showMessageBox(_window, {
                type: 'question',
                title: window.document.title,
                message: 'Do you really want to quit this application?',
                detail: 'Click the button below',
                buttons: ['Cancel', 'Quit']
              }).then((btn) =>{
                if(btn.response){
                  remote.BrowserWindow.getFocusedWindow().destroy();
                  //remote.BrowserWindow.getFocusedWindow().webContents.closeDevTools();
                  window.close();
                }
              });
            });
            /** Event#minimize */
            $('.titlebar .titlebar-minimize').on('click', (event) => {
              _window.minimize();
            });
            /** Event#maximize */
            $('.titlebar .titlebar-resize').on('click', (event) => {
              if(_window.isMaximized()){
                _window.unmaximize();
                $('.titlebar').removeClass('fullscreen');
              } else {
                _window.maximize();
                $('.titlebar').addClass('fullscreen');
              }             
            }); 
            _window.on('maximize',(event) => {
              $('.titlebar').addClass('fullscreen');
            }); 
            _window.on('unmaximize',(event) => {
              $('.titlebar').removeClass('fullscreen');
            });                
          }
        }
      });
    }
  });
}
