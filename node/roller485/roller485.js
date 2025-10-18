/*
 * Node-RED editor definition for Roller485
 * This file runs in the Node-RED editor
 */

module.exports = function(RED) {
    function Roller485Node(config) {
        RED.nodes.createNode(this, config);
    }
    
    RED.nodes.registerType("mcu_roller485", Roller485Node);
};
