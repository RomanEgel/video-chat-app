let myVideoStream;
const videoGrid = document.getElementById('video-grid')
const myVideo = document.createElement('video')
const chatGrid = document.getElementById('chat-box')
const inviteButton = document.getElementById('invite-button')
let lc;
let dc;
let answer;
myVideo.muted = true
navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
}).then(stream => {
    myVideoStream = stream
    addVideoStream(myVideo, stream)
})


function addVideoStream(video, stream) {
    video.srcObject = stream
    video.addEventListener('loadedmetadata', () => {
        video.play()
        videoGrid.append(video)
        openConnection()
    })
}

function openConnection() {
    chatGrid.appendChild(document.createTextNode('Opening connection!\n'))
    const servers = null;
    lc = new RTCPeerConnection(servers)
    
    dc = lc.createDataChannel("chat")
    dc.onmessage = e => chatGrid.append('Message: ' + e.data + '\n')
    dc.onopen = e => chatGrid.appendChild(document.createTextNode('User connected!\n'))

    lc.onicecandidate = e => console.log('Local ICE: ' + JSON.stringify(lc.localDescription))
    lc.createOffer()
        .then(o => lc.setLocalDescription(o))
        .then(a => chatGrid.appendChild(document.createTextNode('Local description updated!\n')))    
}

inviteButton.onclick = function() {
    lc.setRemoteDescription(answer)
}
