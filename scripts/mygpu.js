const rainbow = document.getElementById('rainbow');
const alpaca = document.getElementById('alpaca');
const pikachu = document.getElementById('pikachu');
const helperText = document.getElementById('helper-text');
const hideButton = document.getElementById('hide-button');
const mascotImages = ['../images/alpaca.png', '../images/alpaca_2.png'];

const helperTopLocation = 5;
const speedStep = 0.1;
const bounceBottomLocation = 0;
const initialBottomLocation = -40;

let helperSpeedTimeout = 5;
let showHelper = false;
let helperShown = false;
let helperImageHidden = false;
let currentBottomLocation = initialBottomLocation;

let helperTimeout;

function runMascotAnimationScript() {
    const intervalTime = 600;
    const maxIteration = 30;

    let iteration = 0;

    const intervalId = setInterval(() => {
        if (maxIteration <= iteration) {
            clearInterval(intervalId);
        }
        // change alpaca's legs
        alpaca.src = mascotImages[iteration % mascotImages.length];

        iteration++;
    }, intervalTime);
};

// pikachu fly up
function helperImageMoveUp() {
    currentBottomLocation += speedStep;
    if (!helperImageHidden) {
        if (currentBottomLocation < helperTopLocation) {
            pikachu.style.bottom = currentBottomLocation + '%';
            setTimeout(helperImageMoveUp, helperSpeedTimeout);
        }
        else if (currentBottomLocation >= helperTopLocation) {
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

runMascotAnimationScript();
helperTimeout = setTimeout(helperImageMoveUp, 16000);
