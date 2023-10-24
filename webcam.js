const video = document.querySelector("video");

async function setupWebcam() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const webcamStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { 
                facingMode: "user",
                width: { min: 1024, ideal: 1280, max: 1920 },
                height: { min: 576, ideal: 720, max: 1080 },
         }
        });

        if ('srcObject' in video) {
            video.srcObject = webcamStream
        } else {
            video.src = window.URL.createObjectURL(webcamStream)
        }
        // video.play();
    } else {
        alert("This webcam device is not supported. Please try another device")
    }
}
// video.play()

setupWebcam();

// Prefer camera resolution nearest to 1280x720.
// const constraints = {
//     audio: true,
//     video: { width: 1280, height: 720 },
//   };
  
//   navigator.mediaDevices
//     .getUserMedia(constraints)
//     .then((mediaStream) => {
//       const video = document.querySelector("video");
//       video.srcObject = mediaStream;
//       video.onloadedmetadata = () => {
//         video.play();
//       };
//     })
//     .catch((err) => {
//       // always check for errors at the end.
//       console.error(`${err.name}: ${err.message}`);
//     });
  