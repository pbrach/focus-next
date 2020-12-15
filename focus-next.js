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
    USE_UPPER_LEFT: process.env.FOCUSNEXT_UPPERLEFT == 1 // use upper left point as window coord (default: center point)
};

// cause I currently have no clue how to do this properly in nodejs
class SimpleFileLogger
{
    constructor()
    {
        this.isEnabled = settings.ENABLE_DEBUG;
        this.the_log = '';
        this.fs = require('fs');
        this.filePath = __dirname + '/debug.log';
    }

    writeLog = function (newLogText)
    {
        if (!this.isEnabled)
            return;
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
        winSpec.position = geom.position;
        winSpec.dimension = geom.dimension;

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

function selectFocusCandidateFilter(directionArg)
{
    fileLogger.writeLog(`   selectFocusCandidateFilter :: got direction arg: <${directionArg}>`);

    switch (directionArg) {
        case 'up':
            return _focusCandidateFilter.bind(null, 'top', (other, current) => other <= current);
        case 'left':
            return _focusCandidateFilter.bind(null, 'left', (other, current) => other <= current);
        case 'down':
            return _focusCandidateFilter.bind(null, 'top', (other, current) => other >= current);
        case 'right':
            return _focusCandidateFilter.bind(null, 'left', (other, current) => other >= current);
        default:
            return 'unkown direction command';
    }
}

async function tryGetNextFocusWindowId(focusCandidateFilter, currentFocusedWindow, windows)
{
    const { candidates, tooCloseCandidates } = focusCandidateFilter(currentFocusedWindow, windows);
    fileLogger.writeLog('       :: tryGetNextFocusWindowId: ')
    fileLogger.writeLog('           candidates: ' + candidates.length);
    fileLogger.writeLog('           tooCloseCandidates: ' + tooCloseCandidates.length);

    let nextWnd = null;

    if (candidates.length) {
        const sortedCandidates = weightedSortCandidates(candidates);
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

function weightedSortCandidates(candidatesList)
{
    candidatesList.sort((a, b) => a.dist - b.dist);
    return candidatesList;
}

function _focusCandidateFilter(axis, isInDirection, currentFocusedWindow, windows)
{
    fileLogger.writeLog('\n       :: CandidateFilter:');
    fileLogger.writeLog(`           axis:${axis}`);
    fileLogger.writeLog(`           current focused window: [${currentFocusedWindow.name}]`);
    fileLogger.writeLog(`           total #other windows: ${Object.keys(windows).length}\n`);

    const candidates = [];
    const tooCloseCandidates = [];
    for (const id in windows) {
        if (!windows.hasOwnProperty(id))
            continue;

        const wnd = windows[id];
        let dimOther = 0;
        let dimCurrent = 0;
        wnd.dist = _getDistance(currentFocusedWindow, wnd);

        // if is tooClose, dont filter, add directly to tooClose
        // and dont add to candidates
        const areEual = areEqualOnAxis(axis, currentFocusedWindow.position, wnd.position)
        if (wnd.dist <= 10 || areEual) {
            tooCloseCandidates.push(wnd);
            continue;
        }

        // filter candidate:
        if (axis === 'top') {
            dimOther = wnd.position.top;
            dimCurrent = currentFocusedWindow.position.top;
        }
        else if (axis === 'left') {
            dimOther = wnd.position.left;
            dimCurrent = currentFocusedWindow.position.left;
        }

        if (!isInDirection(dimOther, dimCurrent))
            continue;

        candidates.push(wnd);
    }
    return {
        candidates: candidates,
        tooCloseCandidates: tooCloseCandidates
    };
}

function areEqualOnAxis(axis, pos1, pos2)
{
    const tolerance = 50;
    if (axis === 'top')
        return Math.abs(pos1.top - pos2.top) < tolerance;
    else if (axis === 'left')
        return Math.abs(pos1.left - pos2.left) < tolerance;

    return false;
}

function _getDistance(currentWindow, otherWindow)
{
    const xDiff = currentWindow.position.left - otherWindow.position.left;
    const yDiff = currentWindow.position.top - otherWindow.position.top;

    return xDiff * xDiff + yDiff * yDiff;
}

function _checkInput(directionArg)
{
    const acceptedArgs = ['left', 'up', 'right', 'down'];
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

/**
 * Glorious main method/entry-point
 */
(async () =>
{
    fileLogger.writeLog(`Starting 'focus-next.js'...\n\n`);

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
    const focusCandidateFilter = selectFocusCandidateFilter(directionArg);
    const nextId = await tryGetNextFocusWindowId(focusCandidateFilter, currentFocusedWin, windows);

    fileLogger.writeLog('\n\n3 :: trying to focus find next window id...');
    if (nextId) {
        fileLogger.writeLog(`focussing: [${windows[nextId].name}]`);
        await api.focusNext(nextId);
    }
    else
        fileLogger.writeLog('!!! Found no window to focus!');

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