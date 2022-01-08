let myVideoStream;
const videoGrid = document.getElementById('video-grid')
const myVideo = document.createElement('video')
var videos = []
const chatGrid = document.getElementById('chat-box')
const inviteButton = document.getElementById('invite-button')
const stopVideoButton = document.getElementById('stopVideo')
const muteButton = document.getElementById('muteButton')
let isHost = USER_ACTION == "CREATE"
var streamingConnections = []
var dataConnections = []
myVideo.muted = true;
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
let answer;

const WEB_SERVER = "https://speakingspace.online"
const BACKEND_SERVER_WS = "wss://speakingspace.online";  

var ws = new WebSocket(BACKEND_SERVER_WS + "/video-chat");
var client = Stomp.over(ws);

client.connect({}, function (sessionId) {
    client.subscribe('/user/queue/client-events', function (message) {
        console.log("GOT MESSAGE!!!!")
        const userEvent = JSON.parse(message.body)
        console.log(userEvent)
        switch (userEvent.eventType) {
            case "ROOM_CREATE":
                handleRoomCreation(userEvent)
                break;
            case "USER_JOIN":
                handleUserJoin(userEvent)
                break;
            case "USER_OFFER":
                handleUserOffer(userEvent);
                break;
            case "USER_ANSWER":
                handleUserAnswer(userEvent);
                break;
            case "CONNECTION_UPDATE":
                handleConnectionUpdate(userEvent);
                break;    
            case "USER_QUIT":
                break;                
        }
    }) 

    if (isHost) {
        client.send('/chat/server-events', {}, JSON.stringify(buildCreateEvent()))
    } else {
        client.send('/chat/server-events', {}, JSON.stringify(buildJoinEvent()))
    }
});   

function buildCreateEvent() {
    return {
        "eventType" : "ROOM_CREATE",
        "target": ROOM_ID,
        "payload": USER_NAME
    }
}

function buildJoinEvent() {
    return {
        "eventType": "USER_JOIN",
        "target": ROOM_ID,
        "payload": USER_NAME
    }
}

function buildOfferEvent(target, offer) {
    return {
        "eventType" : "USER_OFFER",
        "target": target,
        "payload": JSON.stringify(offer)
    }
}

function buildAnswerEvent(target, answer) {
    return {
        "eventType" : "USER_ANSWER",
        "target": target,
        "payload": JSON.stringify(answer)
    }
}

function buildConnectionUpdateEvent(target, ice) {
    return {
        "eventType" : "CONNECTION_UPDATE",
        "target": target,
        "payload": JSON.stringify(ice)
    }
}


function handleRoomCreation(userEvent) {
    if (!isHost || ROOM_ID != userEvent.source) {
        console.log("Got message that not supposed to receive")
        return;
    }

    startVideo();
}

function handleUserJoin(userEvent) {
    if (ROOM_ID != userEvent.source) {
        console.log("Got message that not supposed to receive")
        return;
    }

    sendOffer(userEvent.payload)
}

function handleUserOffer(userEvent) {
    startVideo()
        .then(e => sendAnswer(userEvent.source, userEvent.payload))
}

function handleUserAnswer(userEvent) {
    var con = streamingConnections[userEvent.source]
    if (!con) {
        console.log("TARGET IS NOT FOUND. ABORTING")
        return;
    }

    con.setRemoteDescription(JSON.parse(userEvent.payload))
        .then(e => console.log("Remote description set!"))
}

function handleConnectionUpdate(userEvent) {
    var con = streamingConnections[userEvent.source]
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

    client.send("/chat/server-events", {}, JSON.stringify(buildConnectionUpdateEvent(target, ice)))
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
    client.send("/chat/server-events", {}, JSON.stringify({"eventType": "TEST"}))
}


stopVideoButton.onclick = e => {
    myVideoStream.getVideoTracks()[0].enabled ^= true
}

inviteButton.onclick = e => window.alert("JOIN LINK: " + WEB_SERVER + "/?room=" + ROOM_ID)