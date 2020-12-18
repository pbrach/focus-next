#!/usr/bin/node

/**
 * @typedef {import('./common.js').Dimension} Dimension
 * @typedef {import('./common.js').Position} Position
 * @typedef {import('./common.js').WindowGeometry} WindowGeometry
 */

const api = require('./window_api.js');
const { WindowSpec } = require('./common.js');

//GLOBAL SETTINGS:
const settings = {
    ENABLE_DEBUG: process.env.FOCUSNEXT_DEBUGLOG == 1, // create a logfile in same dir where focus-next.js is (default: 0)
    USE_UPPER_LEFT: process.env.FOCUSNEXT_UPPERLEFT == 1, // use upper left point as window coord (default: center point)
    USE_DIAGONAL_COMBINATION: process.env.FOCUSNEXT_DIAGONAL_COMBINATION == 1,
    RUN_DIR_NAME: 'tmp_rundata',
    STATE_FILE_NAME: 'state.json',
    DEBUG_LOG_NAME: 'debug.log',
    APP_NAME: 'focus-next',
};

if (settings.USE_DIAGONAL_COMBINATION)
    createRundirIfNotExit();

const fs = require('fs');
function createRundirIfNotExit()
{
    const runDataDirPath = `${__dirname}/${settings.RUN_DIR_NAME}`;

    if (!fs.existsSync(runDataDirPath)) {
        try {
            fs.mkdirSync(runDataDirPath)
        }
        catch (errorMsg) {
            console.error(`${settings.APP_NAME} was asked to write files to a rundata directory:`);
            console.error(`${runDataDirPath}`);
            console.error(`but that was not possible. Got error:`);
            console.error(errorMsg);
            process.exit(1);
        }
    }
}

// cause I currently have no clue how to do this properly in nodejs
class SimpleFileLogger
{
    constructor()
    {
        this.isEnabled = settings.ENABLE_DEBUG;
        this.the_log = '';
        this.fs = fs;
        this.filePath = `${__dirname}/${settings.RUN_DIR_NAME}/${settings.DEBUG_LOG_NAME}`;

        if (this.isEnabled) {
            createRundirIfNotExit();
        }
    }

    writeLog = function (newLogText)
    {
        if (!this.isEnabled) {
            return;
        }
        this.the_log += '\n' + newLogText;

        this.fs.writeFileSync(this.filePath, this.the_log + '\n', function (err, data)
        {
            // its futile... anyways
            if (err)
                return console.log(err);
        });
    }.bind(this); // make sure we can handle that function to anyone over
}
var fileLogger = new SimpleFileLogger();


async function getCurrentVisibleWindows()
{
    const ids = await api.getCurrentWindowIds();

    const windows = {};
    for (let idx = 0; idx < ids.length; idx++) {
        const winSpec = new WindowSpec();
        winSpec.id = ids[idx];
        winSpec.name = await api.getWindowName(winSpec.id);
        if (
            winSpec.name === 'Desktop'
            // || winSpec.name === 'Peek'
        )
            continue;

        const geom = await api.getWindowGeometry(winSpec.id);
        winSpec.dimension = geom.dimension;
        winSpec.position = createPosition(geom.position, geom.dimension);

        const isTooSmallForRealWindow = winSpec.dimension.width * winSpec.dimension.height < 5;
        if (isTooSmallForRealWindow)
            continue;

        const isHidden = await api.isWindowHidden(winSpec.id)
        if (isHidden)
            continue;

        const posString = `(${geom.position.left}/${geom.position.top})`;
        fileLogger.writeLog(`          Pos: ${posString}${' '.repeat(11 - posString.length)} Name: [${winSpec.name.slice(-30)}] Id: ${winSpec.id}`);

        windows[winSpec.id] = winSpec;
    }

    return windows;
}


/**
 * @param {Position} upperLeftPosition
 * @param {Dimension} dimension
 * @returns {Position}
 */
function createPosition(upperLeftPosition, dimension)
{
    if (settings.USE_UPPER_LEFT)
        return upperLeftPosition;

    return {
        left: upperLeftPosition.left + dimension.width / 2,
        top: upperLeftPosition.top + dimension.height / 2
    }
}

// are coords in direction...:
const in_up = (other, current) => other.top <= current.top;
const in_left = (other, current) => other.left <= current.left;
const in_down = (other, current) => other.top >= current.top;
const in_right = (other, current) => other.left >= current.left;
function selectFocusCandidateFilter(directionArg)
{
    fileLogger.writeLog(`   selectFocusCandidateFilter :: got direction arg:   < ${directionArg} >`);

    switch (directionArg) {
        case 'up':
            return _focusCandidateFilter.bind(null, in_up);
        case 'left':
            return _focusCandidateFilter.bind(null, in_left);
        case 'down':
            return _focusCandidateFilter.bind(null, in_down);
        case 'right':
            return _focusCandidateFilter.bind(null, in_right);
        case 'right-down':
            return _focusCandidateFilter.bind(null, (o, c) => in_right(o, c) && in_down(o, c));
        case 'left-down':
            return _focusCandidateFilter.bind(null, (o, c) => in_left(o, c) && in_down(o, c));
        case 'right-up':
            return _focusCandidateFilter.bind(null, (o, c) => in_right(o, c) && in_up(o, c));
        case 'left-up':
            return _focusCandidateFilter.bind(null, (o, c) => in_left(o, c) && in_up(o, c));
        default:
            return 'unkown direction command';
    }
}

function getDirectionVector(directionArg)
{
    switch (directionArg) {
        case 'up':
            return { left: 0, top: -1 };
        case 'left':
            return { left: -1, top: 0 };
        case 'down':
            return { left: 0, top: 1 };
        case 'right':
            return { left: 1, top: 0 };
        // using the length of '0.707106' gives a unit vector of 45 degree again
        // so we can simplify the calculation
        case 'right-down':
            return { left: 0.707106, top: 0.707106 };
        case 'left-down':
            return { left: -0.707106, top: 0.707106 };
        case 'right-up':
            return { left: 0.707106, top: -0.707106 };
        case 'left-up':
            return { left: -0.707106, top: -0.707106 };
        default:
            throw `Invalid directionArg: ${directionArg}`;
    }
}

async function tryGetNextFocusWindowId(directionArg, currentFocusedWindow, windows)
{
    const { candidates, tooCloseCandidates } = selectFocusCandidateFilter(directionArg)(currentFocusedWindow, windows);
    fileLogger.writeLog('       :: tryGetNextFocusWindowId: ')
    fileLogger.writeLog('           candidates: ' + candidates.length);
    fileLogger.writeLog('           tooCloseCandidates: ' + tooCloseCandidates.length);

    let nextWnd = null;

    if (candidates.length) {
        const directionVector = getDirectionVector(directionArg);
        const sortedCandidates = weightedSortCandidates(directionVector, candidates, currentFocusedWindow);
        nextWnd = sortedCandidates[0];
    }
    // if no normal candidates exist, check the tooClose-list
    else if (tooCloseCandidates.length)
        nextWnd = tooCloseCandidates[0];

    //// Would allow to refocus if in current direction no window exists
    //// but I don't want that ...for now
    // else if(Object.keys(windows).length){
    //     nextWnd = windows[Object.keys(windows)[0]];
    // }

    if (!nextWnd)
        return null;

    return nextWnd.id;
}

/**
 * @param {{left:number, top:number}} directionVector
 * @param {WindowSpec[]} candidatesList 
 * @param {WindowSpec} currentWindow 
 * @returns {WindowSpec[]}
 */
function weightedSortCandidates(directionVector, candidatesList, currentWindow)
{
    const uv = directionVector; //shorter, for 'unit vector'

    const result = candidatesList
        .map(weightDistances)
        .sort((a, b) => a.dist - b.dist);
    return result;

    /**
     * @param {WindowSpec} window
     * @returns {WindowSpec}
     */
    function weightDistances(window)
    {
        // get direction from current window to candidate-window
        const dir = {
            left: window.position.left - currentWindow.position.left,
            top: window.position.top - currentWindow.position.top
        };

        if (dir.left + dir.top === 0)
            throw 'Dir vector is 0, should not happen: should have been pre filtered out into tooCloseCandidates';

        const denominatior = uv.left * dir.left + uv.top * dir.top;

        base = 0.1;
        if (denominatior !== 0)
            base = denominatior / Math.sqrt(dir.left ** 2 + dir.top ** 2);

        if (base < 0)
            throw 'calculation went wrong! got a negative base for the scalingFactor.';

        const scalingFactor = base ** 16;
        window.dist = window.dist / scalingFactor; // favors positions that are within +/- 20 degree of direction vector
        return window;
    }

    function vectorLen(vec)
    {
        return;
    }
}

function _focusCandidateFilter(isInDirection, currentFocusedWindow, windows)
{
    fileLogger.writeLog('\n       :: CandidateFilter:');
    fileLogger.writeLog(`           current focused window: [${currentFocusedWindow.name}]`);
    fileLogger.writeLog(`           total #other windows: ${Object.keys(windows).length}\n`);

    const candidates = [];
    const tooCloseCandidates = [];
    for (const id in windows) {
        if (!windows.hasOwnProperty(id))
            continue;

        const wnd = windows[id];
        wnd.dist = _getDistance(currentFocusedWindow, wnd);

        // if is tooClose, don't filter, add directly to tooClose
        // and dont add to candidates
        if (wnd.dist <= 20) {
            tooCloseCandidates.push(wnd);
            continue;
        }

        // filter candidate:
        if (!isInDirection(wnd.position, currentFocusedWindow.position))
            continue;

        candidates.push(wnd);
    }
    return {
        candidates: candidates,
        tooCloseCandidates: tooCloseCandidates
    };
}

function _getDistance(currentWindow, otherWindow)
{
    const xDiff = currentWindow.position.left - otherWindow.position.left;
    const yDiff = currentWindow.position.top - otherWindow.position.top;

    return xDiff * xDiff + yDiff * yDiff;
}

function _checkInput(directionArg)
{
    const acceptedArgs = ['left', 'up', 'right', 'down', 'left-up', 'left-down', 'right-up', 'right-down'];
    if (acceptedArgs.includes(directionArg))
        return;

    const errorString = 'Given direction argument was wrong. I got: ' + directionArg;
    console.error(errorString);
    fileLogger.writeLog(errorString);
    console.log('The direction arg should be one of:');
    console.log(acceptedArgs);
    process.exit(1);
}

async function emergencyFocusAnyWindow(foundKeys, windows)
{
    fileLogger.writeLog(`   WARNING - no starting window found: selecting first window I get!`);
    if (!foundKeys.length) {
        fileLogger.writeLog(`   ERROR - also no target windows found: nothing open, nothing todo. I quit!`);
        process.exit(1);
    }
    const emergencyId = foundKeys[0];
    fileLogger.writeLog(`focussing: [${windows[emergencyId].name}], id: ${emergencyId}`)

    await api.focusNext(emergencyId);
    fileLogger.writeLog(`\n...finished 'focus-next.js'`);
    process.exit(0);
}

/**@param {number} millisec */
/**@returns {Promise} */
function delay(millisec)
{
    return new Promise((resolve, reject) => setTimeout(resolve, millisec));
}

/**
 * Glorious main method/entry-point
 */
(async () =>
{
    fileLogger.writeLog(`${new Date(Date.now()).toUTCString()}`);
    fileLogger.writeLog(`Starting 'focus-next.js'...\n\n`);
    const minTimeHandle = delay(300);

    var directionArg = process.argv[2];
    _checkInput(directionArg);

    // 1.) get state: all currently visible windos and their positions
    fileLogger.writeLog(`1:: trying to get all windows...`);
    const windows = await getCurrentVisibleWindows();

    const focusedId = await tryAndLogErrorsAway(api.getCurrentFocusedWindowId);
    const currentFocusedWin = windows[focusedId];
    delete windows[focusedId];

    const foundKeys = Object.keys(windows);
    if (!currentFocusedWin)
        await emergencyFocusAnyWindow(foundKeys, windows);

    fileLogger.writeLog(`   current window:`);
    fileLogger.writeLog(`          Pos: (${currentFocusedWin.position.left}/${currentFocusedWin.position.top}) Name: [${currentFocusedWin.name}] Id: ${currentFocusedWin.id}`);

    // 2.) find id of next window to focus
    fileLogger.writeLog(`\n\n2 :: trying to find next window id...`);
    const nextId = await tryGetNextFocusWindowId(directionArg, currentFocusedWin, windows);

    fileLogger.writeLog('\n\n3 :: trying to focus the window with id...');
    if (nextId) {
        fileLogger.writeLog(`focussing: [${windows[nextId].name}]`);
        await api.focusNext(nextId);
    }
    else {
        fileLogger.writeLog('!!! Found no window to focus!');
    }

    //make sure to keep the command open till the delay is over
    await minTimeHandle;
    fileLogger.writeLog(`\n...finished 'focus-next.js'`);
})();

async function tryAndLogErrorsAway(asyncFunc)
{
    let result = null;
    try {
        result = await asyncFunc();
    } catch (err) {
        fileLogger.writeLog(err);
        return null;
    }
    return result;
}