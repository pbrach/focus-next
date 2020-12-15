
// types for js 
// see how this works here: https://jsdoc.app/

/**
 * @typedef Position
 * @type {object}
 * @property {number} left
 * @property {number} top
 */

/**
* @typedef Dimension
* @type {object}
* @property {number} width
* @property {number} height
*/

/** 
 * @typedef WindowGeometry
 * @type {object} 
 * @property {Position} position
 * @property {Dimension} dimension
 **/


class WindowSpec
{
    constructor()
    {
        this.id = "";
        this.name = "";

        /**@type {Position} */
        this.position = { left: 0, top: 0 };

        /**@type {Dimension} */
        this.dimension = { width: 0, height: 0 };
    }
}

module.exports = {
    WindowSpec
}