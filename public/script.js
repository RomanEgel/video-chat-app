let myVideoStream;
const videoGrid = document.getElementById('video-grid')
const myVideo = document.createElement('video')
var videos = []
const chatGrid = document.getElementById('chat-box')
const inviteButton = document.getElementById('invite-button')
const stopVideoButton = document.getElementById('stopVideo')
const muteButton = document.getElementById('muteButton')
const closeButton = document.getElementById('close-button')
var streamingConnections = []
var dataConnections = []
var signalingFinished = []
myVideo.muted = true;
myVideo.enabled = false
const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
};
const servers = {
    iceServers: [
        {urls: 'stun:stun.l.google.com:19302?transport=udp'},
        {urls: 'turn:34.159.76.223:3478', username: "tuta", credential: "tuta"}
    ]
}; 
let accessToken = window.getCookie("access_token_" + USER_ID)
let answer;
let iceCandidatesToSend = []

const WEB_SERVER = "https://speakingspace.online"
const BACKEND_SERVER_WS = "wss://speakingspace.online";  

var ws = new WebSocket(BACKEND_SERVER_WS + "/video-chat?access_token=" + accessToken);
var client = Stomp.over(ws);

var sessionId;

if (!ROOM_ID) {
    alert("ROOM IS NOT SPECIFIED")
} else {
    client.connect({}, function () {
        startInteraction()
    });   
}

function startInteraction() {
    client.subscribe('/topic/client-events/' + ROOM_ID, function (message) {
        console.log("GOT BROADCAST MESSAGE!!!!")
        const userEvent = JSON.parse(message.body)
        console.log(userEvent)
        switch (userEvent.eventType) {
            case "USER_JOIN":
                handleUserJoin(userEvent)
                break;
            case "USER_QUIT":
                handleUserQuit(userEvent)
                break;                
        }
    })

    client.subscribe('/user/queue/client-events/' + ROOM_ID, function (message) {
        console.log("GOT QUEUE MESSAGE!!!!")
        const userEvent = JSON.parse(message.body)
        console.log(userEvent)
        switch (userEvent.eventType) {
            case "USER_OFFER":
                handleUserOffer(userEvent);
                break;
            case "USER_ANSWER":
                handleUserAnswer(userEvent);
                break;
            case "SIGNALING_FINISH":
                handleSignalingFinished(userEvent);
                break;    
            case "CONNECTION_UPDATE":
                handleConnectionUpdate(userEvent);
                break;                  
        }
    })  

    startVideo()
        .then(() => client.send('/chat/server-events', {}, JSON.stringify(buildJoinEvent())))
}

function buildJoinEvent() {
    return {
        "eventType": "USER_JOIN",
        "roomId": ROOM_ID
    }
}

function buildOfferEvent(target, offer) {
    return {
        "eventType" : "USER_OFFER",
        "roomId": ROOM_ID,
        "targetUser": target,
        "payload": JSON.stringify(offer)
    }
}

function buildAnswerEvent(target, answer) {
    return {
        "eventType" : "USER_ANSWER",
        "roomId": ROOM_ID,
        "targetUser": target,
        "payload": JSON.stringify(answer)
    }
}

function buildConnectionUpdateEvent(target, ice) {
    return {
        "eventType" : "CONNECTION_UPDATE",
        "roomId": ROOM_ID,
        "targetUser": target,
        "payload": JSON.stringify(ice)
    }
}

function buildSignalingFinishedEvent(target) {
    return {
        "eventType" : "SIGNALING_FINISH",
        "roomId": ROOM_ID,
        "targetUser": target,
        "payload": null
    }
}

function buildQuitEvent() {
    return {
        "eventType" : "USER_QUIT",
        "roomId": ROOM_ID,
        "targetUser": null,
        "payload": null
    }
}

function handleUserJoin(userEvent) {
    if (ROOM_ID != userEvent.roomId || userEvent.sourceUser == USER_ID) {
        console.log("Got message that not supposed to receive")
        return;
    }

    sendOffer(userEvent.sourceUser)
}

function handleUserQuit(userEvent) {
    if (ROOM_ID != userEvent.roomId || userEvent.sourceUser == USER_ID) {
        console.log("Got message that not supposed to receive")
        return;
    }

    var video = videos[userEvent.sourceUser]
    video.pause()
    video.removeAttribute('src')
    video.load()
}

function handleUserOffer(userEvent) {
    startVideo()
        .then(e => sendAnswer(userEvent.sourceUser, userEvent.payload))
}

function handleUserAnswer(userEvent) {
    var target = userEvent.sourceUser
    var con = streamingConnections[target]
    if (!con) {
        console.log("TARGET IS NOT FOUND. ABORTING")
        return;
    }

    con.setRemoteDescription(JSON.parse(userEvent.payload))
        .then(e => console.log("Remote description set!"))
        .then(e => {
            signalingFinished[target] = true
            console.log("Signaling finished with " + target)
            sendSignalingFinishedEvent(target);
            sendExistingIceCandidates(target);
        })
}

function handleSignalingFinished(userEvent) {
    var target = userEvent.sourceUser;
    var con = streamingConnections[target]
    if (!con) {
        console.log("TARGET IS NOT FOUND. ABORTING")
        return;
    }

    signalingFinished[target] = true;
    console.log("Signaling finished with " + target)
    sendExistingIceCandidates(target);
}

function handleConnectionUpdate(userEvent) {
    var con = streamingConnections[userEvent.sourceUser]
    if (!con) {
        console.log("TARGET IS NOT FOUND. ABORTING")
        return;
    }

    con.addIceCandidate(JSON.parse(userEvent.payload))
}

function sendAnswer(target, offer) {
    createAnswer(target, offer)
        .then(answer => client.send("/chat/server-events", {}, JSON.stringify(buildAnswerEvent(target, answer))))
}

function sendOffer(target) {
    createOffer(target)
        .then(offer => client.send("/chat/server-events", {}, JSON.stringify(buildOfferEvent(target, offer))))
}

function sendConnectionUpdate(target, ice) {
    if (!ice) {
        console.log("All ice candidates have been sent!")
    }

    var con = streamingConnections[target]

    if (!signalingFinished[target]) {
        if (!iceCandidatesToSend[target]) {
            iceCandidatesToSend[target] = []
        }
        iceCandidatesToSend[target].push(ice);
    } else {
        client.send("/chat/server-events", {}, JSON.stringify(buildConnectionUpdateEvent(target, ice)))
    }
}

function sendSignalingFinishedEvent(target) {
    client.send("/chat/server-events", {}, JSON.stringify(buildSignalingFinishedEvent(target)))
}

function sendExistingIceCandidates(target) {
    if (iceCandidatesToSend[target]) {
        for (const ice of iceCandidatesToSend[target]) {
            if (ice) {
                sendConnectionUpdate(target, ice);
            }
        }
    }
}

function createOffer(target) {
    chatGrid.appendChild(document.createTextNode('Opening connection!\n'))
    
    var lc = new RTCPeerConnection(servers)
    lc.onicecandidateerror = e => {console.log("Candidate error"); console.log(e)}
    lc.onnegotiationneeded = e => {console.log("Negotiation needed"); console.log(e)}
    lc.onsignalingstatechange = e => {console.log("Signaling state changed"); console.log(e)}
    var dc = lc.createDataChannel("chat")
    dc.onmessage = e => chatGrid.append('Message: ' + e.data + '\n')
    dc.onopen = e => chatGrid.appendChild(document.createTextNode('User connected!\n'))

    lc.onicecandidate = e => sendConnectionUpdate(target, e.candidate)
    myVideoStream.getTracks().forEach(track => lc.addTrack(track, myVideoStream));
    lc.ontrack = e => {
        var remoteVideo = videos[target]
        if (!remoteVideo) {
            remoteVideo = document.createElement("video")
            videos[target] = remoteVideo
        }

        if (remoteVideo.srcObject !== e.streams[0]) {
            addVideoStream(remoteVideo, e.streams[0])   
            console.log('received remote stream');
        }
    }

    
    streamingConnections[target] = lc
    dataConnections[target] = dc           
    return lc.createOffer(offerOptions)
            .then(o => {
                lc.setLocalDescription(o)
                return o
            })
}

function createAnswer(target, offer) {
    var rc = new RTCPeerConnection(servers)
    rc.setRemoteDescription(JSON.parse(offer)).then(e => console.log("Set remote description"))
    rc.onicecandidateerror = e => {console.log("Candidate error"); console.log(e)}
    rc.onnegotiationneeded = e => {console.log("Negotiation needed"); console.log(e)}
    rc.onsignalingstatechange = e => {console.log("Signaling state changed"); console.log(e)}
    var dc;
    rc.ondatachannel = e => {
        dc = e.channel
        dc.onmessage = e => chatGrid.append('Message: ' + e.data + '\n')
        dc.onopen = e => chatGrid.appendChild(document.createTextNode('User connected!\n'))
    }
    rc.onicecandidate = e => sendConnectionUpdate(target, e.candidate)
    myVideoStream.getTracks().forEach(track => rc.addTrack(track, myVideoStream));
    rc.ontrack = e => {
        var remoteVideo = videos[target]
        if (!remoteVideo) {
            remoteVideo = document.createElement("video")
            videos[target] = remoteVideo
        }

        if (remoteVideo.srcObject !== e.streams[0]) {
            addVideoStream(remoteVideo, e.streams[0])   
            console.log('received remote stream');
        }
    }

    streamingConnections[target] = rc
    dataConnections[target] = dc

    return rc.createAnswer()
                .then(a => {
                    rc.setLocalDescription(a)
                    return a;
                })
}

function startVideo() {
    return navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
            })
            .then(stream => {
                myVideoStream = stream
                myVideoStream.getVideoTracks()[0].enabled = false
                addVideoStream(myVideo, stream)
            })
}


function addVideoStream(video, stream) {
    video.srcObject = stream
    video.addEventListener('loadedmetadata', () => {
        if (iOS()) {
            video.muted = true
            video.autoplay = true
            video.playsinline = true
            video.setAttribute('webkit-playsinline', 'webkit-playsinline');
            video.setAttribute('muted', true);
            video.setAttribute('playsinline', true);
        }
        videoGrid.append(video)
        video.play()
    })
}

function iOS() {
    return [
      'iPad Simulator',
      'iPhone Simulator',
      'iPod Simulator',
      'iPad',
      'iPhone',
      'iPod'
    ].includes(navigator.platform)
    // iPad on iOS 13 detection
    || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  }
  

muteButton.onclick = e => {
    //myVideoStream.getAudioTracks()[0].enabled ^= true
    client.send("/chat/server-events", {}, JSON.stringify({"eventType": "TEST", "roomId": ROOM_ID}))
}


stopVideoButton.onclick = e => {
    myVideoStream.getVideoTracks()[0].enabled ^= true
}

inviteButton.onclick = e => window.alert("JOIN LINK: " + WEB_SERVER + "/?room=" + ROOM_ID)

closeButton.onclick = e => {
    client.send("/chat/server-events", {}, JSON.stringify(buildQuitEvent()))
    location.href = "/"
}

function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) return match[2];
  }