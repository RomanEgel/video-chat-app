let myVideoStream;
const videoGrid = document.getElementById('video-grid')
const myVideo = document.createElement('video')
const remoteVideo = document.createElement('video')
const chatGrid = document.getElementById('chat-box')
const inviteButton = document.getElementById('invite-button')
const stopVideoButton = document.getElementById('stopVideo')
let lc;
let dc;
let rc;
let isHost = window.confirm("Are you host?");
const userId = isHost ? "host" : "client";
myVideo.muted = true;
const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
  };
let answer;  

const serverUrl = "https://speakingspace.online";  

navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
})
.then(stream => {
    myVideoStream = stream
    addVideoStream(myVideo, stream)
})
.then(() => openConnection())

function addVideoStream(video, stream) {
    video.srcObject = stream
    video.addEventListener('loadedmetadata', () => {
        video.muted = true
        video.autoplay = true
        video.playsinline = true
        video.setAttribute('webkit-playsinline', 'webkit-playsinline');
        video.setAttribute('muted', true);
        video.setAttribute('playsinline', true);
        videoGrid.append(video)
        video.play()
    })
}


stopVideoButton.onclick = e => {
    if (isHost) {
        lc.close()
        axios({
            method: 'post',
            url: serverUrl + "/close-room",
            data: {
                "roomId": ROOM_ID,
                "userId": userId
            }
        })
    } else {
        rc.close()
    }
}

function openConnection() {
    const servers = {
        iceServers: [
            {urls: 'stun:stun.l.google.com:19302?transport=udp'},
            {urls: 'turn:34.159.76.223:3478', username: "webrtc", credential: "turnpassword"}
        ]
    };

    if (isHost) {
        chatGrid.appendChild(document.createTextNode('Opening connection!\n'))
        lc = new RTCPeerConnection(servers)
        
        dc = lc.createDataChannel("chat")
        dc.onmessage = e => chatGrid.append('Message: ' + e.data + '\n')
        dc.onopen = e => chatGrid.appendChild(document.createTextNode('User connected!\n'))

        lc.onicecandidate = e => console.log(JSON.stringify(lc.localDescription))
        myVideoStream.getTracks().forEach(track => lc.addTrack(track, myVideoStream));
        lc.ontrack = e => {
            if (remoteVideo.srcObject !== e.streams[0]) {
                addVideoStream(remoteVideo, e.streams[0])   
                console.log('received remote stream');
            }
        }
    
        lc.createOffer(offerOptions)
            .then(o => lc.setLocalDescription(o))
            .then(a => chatGrid.appendChild(document.createTextNode('Local description updated!\n')))
            .then(() => connectToServer())
    } else {
        rc = new RTCPeerConnection(servers)
        rc.ondatachannel = e => {
            dc = e.channel
            dc.onmessage = e => chatGrid.append('Message: ' + e.data + '\n')
            dc.onopen = e => chatGrid.appendChild(document.createTextNode('User connected!\n'))
        }
        rc.onicecandidate = e => console.log(JSON.stringify(rc.localDescription))
        myVideoStream.getTracks().forEach(track => rc.addTrack(track, myVideoStream));
        rc.ontrack = e => {
            if (remoteVideo.srcObject !== e.streams[0]) {
                addVideoStream(remoteVideo, e.streams[0])   
                console.log('received remote stream');
            }
        }
        inviteButton.onclick = connectToServer
    }  
}

function connectToServer() {
    if (isHost) {
        axios({
            method: 'post',
            url: serverUrl + "/create-room",
            data: {
                "roomId": ROOM_ID,
                "userId": userId,
                "offer": JSON.stringify(lc.localDescription)
            }
        })
        .then(response => console.log("SUCCESS !"))
        .then(() => listenToServer())
    } else {
        axios({
            method: 'post',
            url: serverUrl + "/join-room",
            data: {
                "roomId": ROOM_ID,
                "userId": userId,
            }
        })
        .then(response => {console.log("OFFER:"); console.log(response.data); rc.setRemoteDescription(response.data);})
        .then(e => console.log('Description set'))
        .then(e => rc.createAnswer())
        .then(a => rc.setLocalDescription(a))
        .then(() => listenToServer())
    }
}

function listenToServer() {
    var ws = new SockJS(serverUrl + "/chat/connect");
    var client = Stomp.over(ws);
    client.connect({}, function (frame) {
        if (isHost) {
            client.subscribe('/topic/room-' + ROOM_ID, function (message) {
                const chatEvent = JSON.parse(message.body)
                answer = JSON.parse(chatEvent.answer)
                console.log("ANSWER:")
                console.log(answer)
                lc.setRemoteDescription(answer)
                    .then(e => console.log("Connection set!"))
            });
        } else {
            client.send("/chat/connect", {}, JSON.stringify({"roomId": ROOM_ID, "userId": userId, "answer": JSON.stringify(rc.localDescription)}));
        }
      });
}