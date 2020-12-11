const { exec } = require('child_process');

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
                position: { left: match[1], top: match[2] },
                dimension: { width: match[3], height: match[4] },
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

        if (winSpec.dimension.width * winSpec.dimension.height < 5)
            continue;

        windows[winSpec.id] = winSpec;
    }

    return windows;
}

function selectDirection()
{
    var directionArg = process.argv[2];

    console.log(directionArg);

    switch (directionArg) {
        case 'north':
            return focusSetter.bind(null, 'top', (other, current) => other >= current);
        case 'west':
            return focusSetter.bind(null, 'left', (other, current) => other >= current);
        case 'south':
            return focusSetter.bind(null, 'top', (other, current) => other <= current);
        case 'east':
            return focusSetter.bind(null, 'left', (other, current) => other <= current);
        default:
            return 'unkown direction command';
    }
}

async function focusSetter(axis, operator, currentFocusedWindow, windows)
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
        if (!operator(dimOther, dimCurrent))
            continue;

        candidates.push(wnd);
        wnd.dist = (currentFocusedWindow.position.left - wnd.position.left) ** 2 + (currentFocusedWindow.position.top - wnd.position.top) ** 2;
    }

    candidates.sort((a, b) => a.dist - b.dist);

    const nextWnd = candidates[0];
    if (!nextWnd)
        return;

    await focusWindow(nextWnd.id);
}

(async () =>
{
    const windows = await getCurrentWindows();

    console.log(windows);

    const focusedId = await getFocusedId();
    const currentFocusedWin = windows[focusedId];
    delete windows[focusedId];

    const _focusSetter = selectDirection();
    _focusSetter(currentFocusedWin, windows);
})();
