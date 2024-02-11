/*
function updateBlockOutputType(block, types) {
    const blockCheck = block.outputConnection.getCheck()
    if (types && types.length) {
        if (!blockCheck || blockCheck.length === 0 || blockCheck.filter(x => !types.includes(x)).length > 0) {
            block.setOutput(true, types);
            return true;
        }
    } else {
        if (blockCheck && blockCheck.length !== 0) {
            block.setOutput(true, []);
            return true;
        }
    }
    return false;
}

function updateSenseOutputType(event, workspace, senseBlock) {
    const typeBlock = senseBlock.getInputTargetBlock('TYPE');
    let types = []
    if (typeBlock) {
        const typeString = typeBlock.getFieldValue("TYPE")
        types.push(typeString);
    }
    if (updateBlockOutputType(senseBlock, types)) {
        workspace.fireChangeListener(event);
    }
}
Blockly.Blocks['sense'].onchange = function(event) {
    if (event.type === "move") {
        const workspace = Blockly.getMainWorkspace();
        const block = workspace.getBlockById(event.blockId);
        if (block && block.type === 'type') {
            if (event.newParentId) {
                const newParentBlock = workspace.getBlockById(event.newParentId);
                if (newParentBlock.type === "sense") {
                    updateSenseOutputType(event, workspace, newParentBlock);
                }
            }
            if (event.oldParentId) {
                const oldParentBlock = workspace.getBlockById(event.oldParentId);
                if (oldParentBlock.type === "sense") {
                    updateSenseOutputType(event, workspace, oldParentBlock);
                }
            }
        }
    }
};

function updateMuxOutputType(event, workspace, muxBlock) {
    let types = []
    const firstInput = muxBlock.getInput('FIRST_BRANCH');
    const firstInputBlock = firstInput.connection.targetBlock();
    if (firstInputBlock) {
        const firstOutput = firstInputBlock.outputConnection.getCheck();
        if (firstOutput) {
            types = types.concat(firstOutput)
        }
    }
    const secondInput = muxBlock.getInput('SECOND_BRANCH');
    const secondInputBlock = secondInput.connection.targetBlock();
    if (secondInputBlock) {
        const secondOutput = secondInputBlock.outputConnection.getCheck();
        if (secondOutput) {
            types = types.concat(secondOutput)
        }
    }

    if (updateBlockOutputType(muxBlock, types)) {
        workspace.fireChangeListener(event);
    }
}
Blockly.Blocks['mux'].onchange = function(event) {
    if (event.type === "move") {
        const workspace = Blockly.getMainWorkspace();
        if (event.newParentId) {
            const newParentBlock = workspace.getBlockById(event.newParentId);
            if (newParentBlock && newParentBlock.type === "mux") {
                updateMuxOutputType(event, workspace, newParentBlock);
            }
        }
        if (event.oldParentId) {
            const oldParentBlock = workspace.getBlockById(event.oldParentId);
            if (oldParentBlock && oldParentBlock.type === "mux") {
                updateMuxOutputType(event, workspace, oldParentBlock);
            }
        }
    }
};

function updateGetterOutputType(workspace, getterBlock) {
    const data = getterBlock.data
    if (data && data["defineBlockId"]) {
        const defineBlock = workspace.getBlockById(data["defineBlockId"])
        if (defineBlock) {
            const input = defineBlock.getInput('VALUE');
            const connection = input.connection;
            const targetBlock = connection.targetBlock();
            let output = [];
            if (targetBlock) {
                output = targetBlock.outputConnection.getCheck();
            }
            return updateBlockOutputType(getterBlock, output);
        } else {
            getterBlock.dispose(true);
        }
        return false;
    }
}
Blockly.Blocks['getter'].onchange = function(event) {
    const mainWorkspace = Blockly.getMainWorkspace();
    if (event instanceof Blockly.Events.BlockMove) {
        const workspace = Blockly.Workspace.getById(event.workspaceId);
        if (mainWorkspace === workspace) {
            const block = workspace.getBlockById(event.blockId);
            if (block && block.type === 'getter') {
                if (updateGetterOutputType(mainWorkspace, block)) {
                    mainWorkspace.fireChangeListener(event);
                }
            }
        }
    }
};

function defineAndValOnChange(event) {
    //TODO FIRE ALSO ON DELETE OF DEFINE/VAL BLOCKS..
    if (event.type === "move") {
        const workspace = Blockly.getMainWorkspace();
        const getters = workspace.getBlocksByType("getter")
        for (const getter of getters) {
            updateGetterOutputType(workspace, getter)
        }
    }
}
Blockly.Blocks['define'].onchange = function(event) {
    defineAndValOnChange(event);
};

Blockly.Blocks['val'].onchange = function(event) {
    defineAndValOnChange(event);
};
*/