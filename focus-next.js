const api = require('./window_api.js');

var global_log = '';

class WindowSpec
{
    constructor()
    {
        this.id = "";
        this.name = "";
        this.position = { left: 0, top: 0 };
        this.dimension = { width: 0, height: 0 };
    }
}

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
        global_log += `\n           (${geom.position.left}/${geom.position.top})`;
        winSpec.dimension = geom.dimension;

        const isTooSmallForRealWindow = winSpec.dimension.width * winSpec.dimension.height < 5;
        if (isTooSmallForRealWindow)
            continue;

        const isHidden = await api.isWindowHidden(winSpec.id)
        if (isHidden)
            continue;

        windows[winSpec.id] = winSpec;
    }

    return windows;
}

function selectFocusCandidateFilter(directionArg)
{
    global_log += `\ngot direction arg: <${directionArg}>`;

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
    global_log += '\ncandidates: ' + candidates.length;
    global_log += '\ntooCloseCandidates: ' + tooCloseCandidates.length;

    let nextWnd = null;

    if (candidates.length) {
        const sortedCandidates = weightedSortCandidates(candidates);
        nextWnd = sortedCandidates[0];
    }
    // if no normal candidates exist, check the tooClose-list
    else if (tooCloseCandidates.length)
        nextWnd = tooCloseCandidates[0];

    //// Would allow to refocus if in current direction no window exists
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
    global_log += '\n   _focusCandidateFilter:';
    global_log += `\n     axis:${axis}`;
    global_log += `\n     current focused window: [${currentFocusedWindow.name}]`;
    global_log += `\n     total #other windows: ${Object.keys(windows).length}\n`;

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

(async () =>
{
    global_log += `Starting 'focus-next.js'...\n\n`;

    // 1.) get state: all currently visible windos and their positions
    global_log += '\n   >trying to get all windows...';
    const windows = await getCurrentVisibleWindows();

    const focusedId = await api.getCurrentFocusedWindowId();
    const currentFocusedWin = windows[focusedId];
    delete windows[focusedId];

    // 2.) find id of next window to focus
    global_log += '\n   >trying to find next window id...';
    var directionArg = process.argv[2];
    const focusCandidateFilter = selectFocusCandidateFilter(directionArg);
    const nextId = await tryGetNextFocusWindowId(focusCandidateFilter, currentFocusedWin, windows);

    // 3.) focus the found 'next'
    global_log += '\n   >trying to focus find next window id...';
    if (nextId) {
        global_log += `\n focussing: [${windows[nextId].name}]`;
        await api.focusWindow(nextId);
    }
    else
        global_log += '\n!!! Found no window to focus!';

    global_log += `\n\n...finished 'focus-next.js'`;
    // writeLog();
})();

function writeLog()
{
    fs = require('fs');
    global_log += '\n';
    fs.writeFile('focus_next_log.out', global_log, function (err, data)
    {
        if (err)
            return console.log(err);

        console.log(global_log);
    });
}