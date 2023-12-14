const rainbow = document.getElementById('rainbow');
const alpaca = document.getElementById('alpaca');
const pikachu = document.getElementById('pikachu');
const images = ['../images/alpaca.png', '../images/alpaca_2.png'];
const maxIterationCount = 25;
const helperBottomLocation = 20;
const speedStep = 0.1;
const bounceBottomLocation = 10;
const duration = 20000;

let currentIndex = 0;
let iterationCount = 0;
let intervalTime = 700;
let currentBottomLocation = -40;
let helperSpeedTimeout = 5;
let showHelper = false;

let helperTimeout;

// change alpaca's legs
function changeImage() {
    alpaca.src = images[currentIndex];
    currentIndex = (currentIndex + 1) % images.length;
    iterationCount++;

    if (iterationCount === maxIterationCount) {
        clearInterval(intervalId);
    }
}

// pikachu fly up
function showHelperPicture() {
    console.log(helperTimeout)
    currentBottomLocation += speedStep;
    if (currentBottomLocation < helperBottomLocation) {
        pikachu.style.bottom = currentBottomLocation + '%';
        setTimeout(showHelperPicture, helperSpeedTimeout);
    }
    else if (currentBottomLocation >= helperBottomLocation) {
        showHelper = true;
        helperSpeedTimeout = 20;
        startBouncing();
    }
}

// pikachu bounce
function startBouncing() {
    currentBottomLocation -= speedStep;
    if (currentBottomLocation > bounceBottomLocation) {
        pikachu.style.bottom = currentBottomLocation + '%';
        setTimeout(startBouncing, helperSpeedTimeout);
    }
    else if (currentBottomLocation <= bounceBottomLocation) {
        showHelperPicture();
    }
}

// hide pikachu on click 
function hideHelperPicture() {
    helperSpeedTimeout = 5;
    currentBottomLocation -= speedStep;
    if (currentBottomLocation > -40) {
        pikachu.style.bottom = currentBottomLocation + '%';
        setTimeout(hideHelperPicture, helperSpeedTimeout);
    } else {
        clearTimeout(helperTimeout);
    }
}

pikachu.addEventListener('click', function() {
    hideHelperPicture();
    showHelper = false;
});

const intervalId = setInterval(changeImage, intervalTime);
if(helperTimeout !== 0) helperTimeout = setTimeout(showHelperPicture, 21000);