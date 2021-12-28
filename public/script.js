let myVideoStream;
const videoGrid = document.getElementById('video-grid')
const myVideo = document.createElement('video')
const remoteVideo = document.createElement('video')
const chatGrid = document.getElementById('chat-box')
const inviteButton = document.getElementById('invite-button')
let lc;
let dc;
let rc;
let remoteDescription;
myVideo.muted = true;
const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
  };


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
    video.muted = true
    video.addEventListener('loadedmetadata', () => {
        video.play()
        videoGrid.append(video)
    })
}

function openConnection() {
    const servers = null;

    if (window.confirm("Are you host?")) {
        chatGrid.appendChild(document.createTextNode('Opening connection!\n'))
        lc = new RTCPeerConnection(servers)
        window.onclose = e => {lc.close()} 
        
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
        inviteButton.onclick = () => lc.setRemoteDescription(remoteDescription)            
    } else {
        rc = new RTCPeerConnection(servers)
        window.onclose = e => {rc.close()} 
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
        inviteButton.onclick = () => {
            rc.setRemoteDescription(remoteDescription).then(e => console.log('Description set'))
            rc.createAnswer()
                .then(a => rc.setLocalDescription(a))
        }
    }  
}