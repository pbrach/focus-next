const { exec } = require('child_process');

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

function handleError(error, stderr, rejectCallback)
{
    if (error || stderr) {
        let errorText = 'An error occured:\n';
        errorText += error.message + ' ' + stderr;
        rejectCallback(errorText);
    }
}

function getWinIds()
{
    return new Promise((resolve, reject) =>
    {
        exec('xdotool search --onlyvisible --sync --all --name --class --classname "\\S+"',
            (error, stdout, stderr) =>
            {
                handleError(error, stderr, reject);

                stdout = stdout.trim();
                resolve(stdout.split('\n'));
            });
    });
}

function getName(id)
{
    const command = `xdotool getwindowname ${id}`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            handleError(error, stderr, reject);

            resolve(stdout.trim());
        });
    });
}

function getFocusedId()
{
    const command = `xdotool getwindowfocus`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            handleError(error, stderr, reject);

            resolve(stdout.trim());
        });
    });
}

const regexp = /^Window\s.*\n\s\sPosition:\s(.*),(.*)\s\(.*\n\s\sGeometry:\s(.*)x(.*)/m;
function getGeometry(id)
{
    const command = `xdotool getwindowgeometry ${id}`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            handleError(error, stderr, reject);

            const match = stdout.match(regexp);
            const result = {
                position: { left: parseInt(match[1]), top: parseInt(match[2]) },
                dimension: { width: parseInt(match[3]), height: parseInt(match[4]) },
            }
            resolve(result);
        });
    });
}

function focusWindow(id)
{
    const command = `xdotool windowraise ${id} && xdotool windowfocus ${id}`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            handleError(error, stderr, reject);

            resolve();
        });
    });
}

async function getCurrentWindows()
{
    const ids = await getWinIds();

    const windows = {};
    for (let idx = 0; idx < ids.length; idx++) {
        const winSpec = new WindowSpec();
        winSpec.id = ids[idx];
        winSpec.name = await getName(winSpec.id);
        if (winSpec.name === 'Desktop')
            continue;

        const geom = await getGeometry(winSpec.id);
        winSpec.position = geom.position;
        winSpec.dimension = geom.dimension;

        const isTooSmallForRealWindow = winSpec.dimension.width * winSpec.dimension.height < 5;
        if (isTooSmallForRealWindow)
            continue;

        const isHidden = await isWindowHidden(winSpec.id)
        if (isHidden)
            continue;

        windows[winSpec.id] = winSpec;
    }

    return windows;
}

function isWindowHidden(id)
{
    const command = `xwininfo -wm -id ${id}`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            handleError(error, stderr, reject);

            const stateText = stdout.split('Window state:')[1];
            if (!stateText)
                resolve(false);
            else
                resolve(stateText.includes('Hidden'));
        });
    });
}

function selectDirection()
{
    var directionArg = process.argv[2];

    global_log += directionArg.toString();

    switch (directionArg) {
        case 'up':
            return focusSetter.bind(null, 'top', (other, current) => other <= current);
        case 'left':
            return focusSetter.bind(null, 'left', (other, current) => other <= current);
        case 'down':
            return focusSetter.bind(null, 'top', (other, current) => other >= current);
        case 'right':
            return focusSetter.bind(null, 'left', (other, current) => other >= current);
        default:
            return 'unkown direction command';
    }
}

async function focusSetter(axis, isInDirection, currentFocusedWindow, windows)
{
    global_log += `\n focusSetter:: axis:${axis}, ${currentFocusedWindow.name}, windows.len: ${Object.keys(windows).length}`;

    const candidateWindows = _getFocusCandidates(axis, isInDirection, currentFocusedWindow, windows)
    global_log += '\nSorted candidates: ' + candidateWindows.length;

    // pick best candidate:
    candidateWindows.sort((a, b) => a.dist - b.dist);
    const nextWnd = candidateWindows[0];

    if (!nextWnd) {
        global_log += '\n!!!No candidate no focus!';
        return;
    }

    global_log += '\n Focussing: ' + nextWnd.name;
    await focusWindow(nextWnd.id);
}

function _getFocusCandidates(axis, isInDirection, currentFocusedWindow, windows)
{
    const candidates = [];
    for (const id in windows) {
        if (!windows.hasOwnProperty(id))
            continue;

        const wnd = windows[id];
        let dimOther = 0;
        let dimCurrent = 0;
        if (axis === 'top') {
            dimOther = wnd.position.top;
            dimCurrent = currentFocusedWindow.position.top;
        }
        else if (axis === 'left') {
            dimOther = wnd.position.left;
            dimCurrent = currentFocusedWindow.position.left;
        }

        // operator: other is in direction of dimCurrent...
        if (!isInDirection(dimOther, dimCurrent))
            continue;

        candidates.push(wnd);
        wnd.dist = (currentFocusedWindow.position.left - wnd.position.left) ** 2 + (currentFocusedWindow.position.top - wnd.position.top) ** 2;
    }
    return candidates;
}

(async () =>
{
    const windows = await getCurrentWindows();

    const focusedId = await getFocusedId();
    const currentFocusedWin = windows[focusedId];
    delete windows[focusedId];

    const _focusSetter = selectDirection();
    _focusSetter(currentFocusedWin, windows);

    writeLog();
})();

function writeLog()
{
    fs = require('fs');
    global_log += '\n';
    fs.writeFile('/home/haphi/focus_next_log.out', global_log, function (err, data)
    {
        if (err)
            return console.log(err);

        console.log(global_log);
    });
}