import { YOLO_CLASSES } from "./labels.js";

const video = document.querySelector("video");
const playBtn = document.getElementById("play");
const pauseBtn = document.getElementById("pause");

const worker = new Worker("worker.js");
let interval;
let boxes = [];
let busy = false;

/* Capture video frames */
playBtn.addEventListener("click", () => {    
    video.play();
    
});

pauseBtn.addEventListener("click", () => {
    video.pause();
});


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

// if (navigator.mediaDevices.getUserMedia) {
//     navigator.mediaDevices.getUserMedia({ video: true })
//         .then(function (stream) {
//             video.srcObject = stream;
//         })
//         .catch(function (error) {
//             console.log("Something went wrong!");
//         });
// }
setupWebcam();

// Prefer camera resolution nearest to 1280x720.
// const constraints = {
//     audio: true,
//     video: {facingMode: "user",},
//     width: { min: 1024, ideal: 1280, max: 1920 },
//     height: { min: 576, ideal: 720, max: 1080 },
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
  
video.addEventListener("play",  async() => {
    // console.log("Clicked play");
    const canvas = document.querySelector("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    console.log(video.videoHeight, video.videoWidth)
    const context = canvas.getContext("2d");
    interval = setInterval(() => {
        context.drawImage(video, 0, 0);
        // console.log("Drawn Image");
        draw_boxes(canvas, boxes);
        // console.log("Drawn Box");
        const input = prepareInput(canvas);
        // console.log("Input prepared");
        if (!busy) {
            worker.postMessage(input);
            busy = true;        }
    })
});

worker.onmessage = (event) => {
    const output = event.data;
    const canvas = document.querySelector("canvas");
    boxes = processOutput(output, canvas.width, canvas.height);
    busy = false;    
        
    let predClass;
    let predsCount = {};

    for (const box of boxes) {
        predClass = box[4];

        if (predClass in predsCount){
            predsCount[predClass]++;
        } else {
            predsCount[predClass] = 1;
        }
    }
    
    for (const [predClass, count] of Object.entries(predsCount)) {
        console.log(predClass, count);
    }
    window.requestAnimationFrame(() => {
        worker.onmessage
    })
}

video.addEventListener("pause", () => {
    clearInterval(interval);
})

/* Detect objects in video */

function prepareInput(img) {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const context = canvas.getContext("2d");
    context.drawImage(img, 0, 0, 640, 640);

    const data = context.getImageData(0, 0, 640, 640).data;
    const red = [], green = [], blue = [];
    for (let index = 0; index < data.length; index+=4){
        red.push(data[index]/255);
        green.push(data[index+1]/255);
        blue.push(data[index+2]/255);
    }
    return [...red, ...green, ...blue];
}


/* Process the output */
function processOutput(output, img_width, img_height) {
    let boxes = [];
    for (let index=0; index < 8400; index++) {
        const [class_id, prob] = [...Array(80).keys()]
            .map(col => [col, output[8400*(col+4)+index]])
            .reduce((accum, item) => item[1]>accum[1] ? item : accum, [0, 0]);
        if (prob < 0.7) {
            continue;
        }
        const label = YOLO_CLASSES[class_id];
        const xc = output[index];
        const yc = output[8400+index];
        const w = output[2*8400+index];
        const h = output[3*8400+index];
        const x1 = (xc-w/2)/640*img_width;
        const y1 = (yc-h/2)/640*img_height;
        const x2 = (xc+w/2)/640*img_width;
        const y2 = (yc+h/2)/640*img_height;
        boxes.push([x1,y1,x2,y2,label,prob]);           
    } 

    boxes = boxes.sort((box1,box2) => box2[5]-box1[5])
    const result = [];
    while (boxes.length>0) {
        result.push(boxes[0]);
        boxes = boxes.filter(box => iou(boxes[0],box)<0.7);
    }
    return result;
}

/* Draw bounding boxes */

function draw_boxes(canvas,boxes) {
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 3;
    ctx.font = "18px serif";
    boxes.forEach(([x1,y1,x2,y2,label]) => {
        ctx.strokeRect(x1,y1,x2-x1,y2-y1);
        ctx.fillStyle = "#00ff00";
        const width = ctx.measureText(label).width;
        ctx.fillRect(x1,y1,width+10,25);
        ctx.fillStyle = "#000000";
        ctx.fillText(label, x1, y1+18);
    });
}

/* Helper Functions */

// Intersection
function intersection(box1,box2) {
    const [box1_x1,box1_y1,box1_x2,box1_y2] = box1;
    const [box2_x1,box2_y1,box2_x2,box2_y2] = box2;
    const x1 = Math.max(box1_x1,box2_x1);
    const y1 = Math.max(box1_y1,box2_y1);
    const x2 = Math.min(box1_x2,box2_x2);
    const y2 = Math.min(box1_y2,box2_y2);
    return (x2-x1)*(y2-y1)
}

// Union
function union(box1,box2) {
    const [box1_x1,box1_y1,box1_x2,box1_y2] = box1;
    const [box2_x1,box2_y1,box2_x2,box2_y2] = box2;
    const box1_area = (box1_x2-box1_x1)*(box1_y2-box1_y1)
    const box2_area = (box2_x2-box2_x1)*(box2_y2-box2_y1)
    return box1_area + box2_area - intersection(box1,box2)
}

// Intersection Over Union
function iou(box1,box2) {
    return intersection(box1,box2)/union(box1,box2);
}