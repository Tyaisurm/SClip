const remote = require('electron').remote
const path = require('path')
const url = require('url')
const { ipcRenderer } = require('electron')
const currentWindow = remote.getCurrentWindow();

let is_setted = false;
toggleviewmode(0);
toggleviewmode(2);

ipcRenderer.send('is-set-up', currentWindow.id);

ipcRenderer.on('log2console', (event, arg) => {//log stuff for closer inspection into chrome console
    console.log("start-server-reply: RENDERER");
    console.log(arg);
});


ipcRenderer.on('start-server-reply', (event, arg) => {//server start underway
    console.log("start-server-reply: RENDERER");
    console.log(arg);
    toggleviewmode(1);
    $("#mode-h1").text("Current mode: server");
});
ipcRenderer.on('start-client-reply', (event, arg) => {//client start underway
    console.log("start-client-reply: RENDERER");
    console.log(arg);
    toggleviewmode(1);
    $("#mode-h1").text("Current mode: client");
});
ipcRenderer.on('is-set-up-reply', (event, arg) => {//is already setted up! nothing to do here...
    console.log("is-set-up-reply: RENDERER");
    console.log(arg);
    is_setted = arg[0];
    if (is_setted) {
        $("#mode-h1").text("Current mode: " + arg[1]);
        toggleviewmode(1);
    }
    else {
        $("#mode-h1").text("Current mode: Nothing");
        toggleviewmode(3);
        toggleviewmode(0);
    }
});

document.getElementById("close-win-btn").onclick = function () {
    console.log("close window button");
    currentWindow.close();
}

document.getElementById("set-server-btn").onclick = function () {
    console.log("setup server button");
    ipcRenderer.send("start-server","");
}

document.getElementById("set-client-btn").onclick = function () {
    console.log("setup client button");
    var serverIP = $("#set-client-input").val();
    console.log(serverIP);
    var check = validateIPaddress(serverIP);
    console.log(check);
    if (check) {
        ipcRenderer.send("start-client", serverIP);
        $("#client-error").text("");
    }
    else {
        $("#client-error").text("Please enter valid IP address!")
    }
}

currentWindow.on('focus', function () { $("html").css("opacity", "1"); });
currentWindow.on('blur', function () { $("html").css("opacity", "0.5"); });

function validateIPaddress(ipaddress) {
    if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress)) {
        return (true)
    }
    console.log("You have entered an invalid IP address!")
    return (false)
}

// mode 0 = all available, mode 1 = already set up, mode 2 = disable controls, mode 3 = enable controls
function toggleviewmode(mode) {
    console.log("toggelviewmode: "+mode);
    if (mode === 0) {
        $("#inputDIV").removeClass("not-shown");
        $("#statusDIV").addClass("not-shown");
    }
    else if (mode === 1) {
        $("#inputDIV").addClass("not-shown");
        $("#statusDIV").removeClass("not-shown");
    }
    else if (mode === 2) {
        $("#set-server-btn").addClass("element-disabled");
        $("#set-client-btn").addClass("element-disabled");
    }
    else if (mode === 3) {
        $("#set-server-btn").removeClass("element-disabled");
        $("#set-client-btn").removeClass("element-disabled");
    }
}