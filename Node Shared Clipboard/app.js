const electron = require('electron')
const { app, Menu, Tray } = electron
const ipcMain = electron.ipcMain
const clipboard = electron.clipboard
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow
const net = require('net')

const path = require('path')
const url = require('url')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null //actual window itself
let last_clipboard_content = null
let appIcon = null
let checkTimer = null
let setted_up = false
let setted_mode = "nothing";

var port = 7585;
var peers = [];
var settingsWin = null; //event sender
var server_client = null;
var server_server = null;

ipcMain.on('is-set-up', (event, arg) => { //answer if set up already
    //console.log(arg);
    settingsWin = event.sender;
    console.log("is-set-up: MAIN");
    event.sender.send('is-set-up-reply', [setted_up, setted_mode])
});
ipcMain.on('start-server', (event, arg) => { //setup server
    appIcon.setImage(path.join(__dirname, "win-icon-red.png"));
    appIcon.setToolTip('SClip Application - Server')
    //console.log(arg);
    console.log("start-server: MAIN");
    setted_up = true;
    setted_mode = "server";
    createServer();
    event.sender.send('start-server-reply', '')
});
ipcMain.on('start-client', (event, arg) => { //setup client
    appIcon.setImage(path.join(__dirname, "win-icon-blue.png"));
    appIcon.setToolTip("SClip Application - Client")
    //console.log(arg);
    console.log("start-client: MAIN");
    setted_up = true;
    setted_mode = "client";
    connectServer(arg);
    createServer();
    event.sender.send('start-client-reply', '')
});

function checkAndPush() {
    console.log("checkAndPush");
    //console.log("peers: "+peers);
    var clipboardContent = null;
    var availableformats = clipboard.availableFormats();
    // check if clipboard has image or text
    var temp = "";
    if (clipboard.readImage().isEmpty()) {
        temp = clipboard.readText();
        clipboardContent = Buffer.from(temp, 'utf8');
    }
    else {
        temp = clipboard.readImage();
        clipboardContent = getImageBuffer(temp, availableformats);
    }
    //console.log(clipboardContent.toString());
    if (clipboardContent === null || clipboardContent.length === 0 || peers.length === 0) {
        //console.log("INVALID CONTENTS!");
        return;
    }
    if (last_clipboard_content !== null) {
        if (clipboardContent.equals(last_clipboard_content)){
            //console.log("INVALID CONTENTS!");
            return;
        }
    }
    //console.log("VALID! Continuing...");

    //settingsWin.send("log2console", clipboardContent);
    //settingsWin.send("log2console", last_clipboard_content);
    //console.log(availableformats);
    //console.log("######################################");
    var messageData = clipboardContent
    
    //console.log("messageData: "+ messageData);
    for (var i = 0; i < peers.length; i++) {
        var socket = peers[i];
        console.log("Sending to peer: " + i);
        //console.log(messageData);
        socket.write(messageData);
    }
    //console.log("Replacing old clipdata....");
    last_clipboard_content = messageData;
}

function getImageBuffer(data, formats) {
    console.log("getImageBuffer");
    for (var i = 0; i < formats.length; i++){
        if (formats[i] === ("image/png")) {
            return data.toPNG();
        }
        else if (formats[i] === ("image/jpg")) {
            return data.toJPEG(100);
            
        }
        else if (formats[i] === ("image/bmp")) {
            return data.toBitmap();
        }
    }
    return null;
}

function connectServer(host) {
    console.log("connectServer: "+host);
//connect to server
    
    if (server_client !== null) {
        server_client.destroy();
        server_client = null;
    }
    

    server_client = net.connect({ port: port, host: host },
        function () {
            console.log("client connected");
            //add new client
            peers.push(server_client);
            console.log("PEER ADDED(connectServer): " + server_client.remoteAddress + ":" + server_client.remotePort);
            checkAndPush();
        });
    server_client.on('data', function (data) {
        
        var newimage = electron.nativeImage.createFromBuffer(data);
        //settingsWin.send("log2console", newimage.isEmpty());// if true, what was received was not image....
        if (!newimage.isEmpty()) {
            clipboard.clear();
            clipboard.writeImage(newimage);
        }
        else {
            clipboard.clear();
            clipboard.writeText(data.toString());
        }
    });
    server_client.on('end', function () {
        console.log("client disconnected");
        var index = peers.indexOf(server_client);
        if (index > -1) {
            console.log("remove client - end");
            peers.splice(index, 1);
            //server_client = null;
            setted_up = false
            setted_mode = "nothing";
            if (mainWindow !== null) { mainWindow.reload(); appIcon.setImage(path.join(__dirname, "win-icon.png")); }
            let myNotification = new Notification('Client disconnected(CLIENT)', {
                body: 'SClip client has been disconnected!'
            })
        }
    });
    server_client.on('error', function () {
        console.log("client error");
        var index = peers.indexOf(server_client);
        if (index > -1) {
            console.log('remove client - error');
            peers.splice(index, 1);
            //server_client = null;
            setted_up = false
            setted_mode = "nothing";
            //server_client.destroy();
            if (mainWindow !== null) { mainWindow.reload(); appIcon.setImage(path.join(__dirname, "win-icon.png")); }
            let myNotification = new Notification('Client removed(CLIENT)', {
                body: 'SClip client has been removed because of an error!'
            })
        }
    });
    //setTimeout(function () { server_client.end()}, 5000);
}

function createServer() {
    console.log("createServer");

    if (server_server !== null){
        server_server.close();
        server_server = null;
        clearInterval(checkTimer);
    }

    server_server = net.createServer(function (socket) {
        //add new client
        peers.push(socket);
        console.log("PEER ADDED(createServer): " + socket.remoteAddress + ":" + socket.remotePort);

        //send data
        socket.on('data', function (chunk) {
            //console.log("SOCKET DATA");
            for (var i = 0; i < peers.length; i++) {
                var client = peers[i];
                if (client != socket) {
                    console.log("write to client: " + i);
                    //console.log(chunk.toString());
                    client.write(chunk);
                }
                else {
                    var newimage = electron.nativeImage.createFromBuffer(chunk);
                    //settingsWin.send("log2console", newimage.isEmpty());// if true, what was received was not image....
                    if (!newimage.isEmpty()) {
                        clipboard.clear();
                        clipboard.writeImage(newimage);
                    }
                    else {
                        clipboard.clear();
                        clipboard.writeText(chunk.toString());
                    }
                }
            }
        });

        //remove client
        socket.on('end', function () {
            var index = peers.indexOf(socket);
            if (index > -1) {
                console.log("removed client: end");
                peers.splice(index, 1);
            }
            console.log("client disconnected");
            let myNotification = new Notification('Client disconnected(SERVER)', {
                body: 'SClip client has been disconnected!'
            })
        });

        //error handling
        socket.on('error', function (err) {
            console.log("Caught error");
            var index = peers.indexOf(socket);
            if (index > -1) {
                console.log("removed client: error");
                peers.splice(index, 1);
                let myNotification = new Notification('Client removed(SERVER)', {
                    body: 'SClip client has been removed because of an error!'
                })
            }
        });
    });

    server_server.listen(port, function () {
        console.log("server bound to port "+port);
    });
    checkTimer = setInterval(checkAndPush, 1000);
}

function createApp() {    
    console.log("createApp");
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    const iconPath = path.join(__dirname, "win-icon.png")
    appIcon = new Tray(iconPath)
    const contextMenu = Menu.buildFromTemplate([
        {
            label: "SClip Control Panel",
            enabled: false
        },
        {
            label: 'Setup',
            click: function () {
                
                mainWindow = new BrowserWindow({ width: 800, height: 600, frame: false })

                mainWindow.loadURL(url.format({
                    pathname: path.join(__dirname, 'settings.html'),
                    protocol: 'file:',
                    slashes: true
                }))

                // Open the DevTools.
                // mainWindow.webContents.openDevTools()

                // Emitted when the window is closed.
                mainWindow.on('closed', function () {
                    // Dereference the window object, usually you would store windows
                    // in an array if your app supports multi windows, this is the time
                    // when you should delete the corresponding element.
                    mainWindow = null
                })
                
        }
        },
        {
            label: 'Shutdown',
            click: function () {
                if (mainWindow !== null) { mainWindow.destroy(); }
                app.quit();
        }
        }
    ])

    // Call this again for Linux because we modified the context menu
    appIcon.setToolTip('SClip Application')
    appIcon.setContextMenu(contextMenu)

    if (process.platform === "win32") {
        var ballOptions = {
            title: "SClip Application",
            content: "Application started. Click tray icon for setup."
        }
        appIcon.displayBalloon(ballOptions);
    }

/////////////////////////////////////////////////////////////////////////////////////////////////////
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => { setTimeout(createApp, 0) })

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        //app.quit()
    }
})

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        //createWindow()
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
