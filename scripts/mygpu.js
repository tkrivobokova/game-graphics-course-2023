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
const initialBottomLocation = -40;

let currentIndex = 0;
let iterationCount = 0;
let intervalTime = 700;
let currentBottomLocation = initialBottomLocation;
let helperSpeedTimeout = 5;
let showHelper = false;
let helperShown = false;
let helperImageHidden = false;

let helperTimeout;

// change alpaca's legs
function changeMascotImage() {
    alpaca.src = images[currentIndex];
    currentIndex = (currentIndex + 1) % images.length;
    iterationCount++;

    if (iterationCount === maxIterationCount) {
        clearInterval(intervalId);
    }
}

// pikachu fly up
function helperImageMoveUp() {
    currentBottomLocation += speedStep;
    if (!helperImageHidden) {
        if (currentBottomLocation < helperBottomLocation) {
            pikachu.style.bottom = currentBottomLocation + '%';
            setTimeout(helperImageMoveUp, helperSpeedTimeout);
        }
        else if (currentBottomLocation >= helperBottomLocation) {
            helperSpeedTimeout = 20;
            helperImageBounce();
        }
    }
}

// pikachu bounce
function helperImageBounce() {
    currentBottomLocation -= speedStep;
    if (currentBottomLocation > bounceBottomLocation) {
        pikachu.style.bottom = currentBottomLocation + '%';
        setTimeout(helperImageBounce, helperSpeedTimeout);
    }
    else if (currentBottomLocation <= bounceBottomLocation) {
        showHelper = true;
        if(showHelper && !helperShown) {
            showHelperText();
        }
        helperImageMoveUp();
    }
}

// hide pikachu on click 
function hideHelper() {
    helperSpeedTimeout = 5;
    currentBottomLocation -= speedStep;
    if (currentBottomLocation > initialBottomLocation) {
        pikachu.style.bottom = currentBottomLocation + '%';
        setTimeout(hideHelper, helperSpeedTimeout);
    } else {
        helperImageHidden = true;
        pikachu.style.display = 'none';
    }
    
}

// show helper text
function showHelperText() {
    helperShown = true;
    helperText.style.opacity = 1;
}

hideButton.addEventListener('click', function() {
    helperText.style.display = 'none';
    showHelper = false;
    hideHelper();
})


const intervalId = setInterval(changeMascotImage, intervalTime);
helperTimeout = setTimeout(helperImageMoveUp, 16000);