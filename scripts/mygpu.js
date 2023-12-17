const rainbow = document.getElementById('rainbow');
const alpaca = document.getElementById('alpaca');
const pikachu = document.getElementById('pikachu');
const helperText = document.getElementById('helper-text');
const hideButton = document.getElementById('hide-button');
const images = ['../images/alpaca.png', '../images/alpaca_2.png'];
const maxIterationCount = 25;
const helperBottomLocation = 10;
const speedStep = 0.1;
const bounceBottomLocation = 2.5;

let currentIndex = 0;
let iterationCount = 0;
let intervalTime = 700;
let currentBottomLocation = -40;
let helperSpeedTimeout = 5;
let showHelper = false;
let helperShown = false;

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
    currentBottomLocation += speedStep;
    if (currentBottomLocation < helperBottomLocation) {
        pikachu.style.bottom = currentBottomLocation + '%';
        setTimeout(showHelperPicture, helperSpeedTimeout);
    }
    else if (currentBottomLocation >= helperBottomLocation) {
        
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
        
        showHelper = true;
        if(showHelper && !helperShown) {
            showHelperText();
        }
        showHelperPicture();
    }
}

// hide pikachu on click 
function hideHelper() {
    helperText.style.display = 'none';
    helperSpeedTimeout = 5;
    currentBottomLocation -= speedStep;
    if (currentBottomLocation > -40) {
        pikachu.style.bottom = currentBottomLocation + '%';
        setTimeout(hideHelperPicture, helperSpeedTimeout);
    } else {
        pikachu.style.display = 'none';
    }
}

function showHelperText() {
    helperShown = true;
    helperText.style.opacity = 1;
}

pikachu.addEventListener('click', function() {
    hideHelper();
    showHelper = false;
});

const intervalId = setInterval(changeImage, intervalTime);
helperTimeout = setTimeout(showHelperPicture, 16000);