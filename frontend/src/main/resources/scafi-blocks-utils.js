//#region Blockly2Scafi File Loadings

if(window.scafiBlocklyStore === undefined) {
    window.scafiBlocklyStore = null;
}

function storeWorkspace() {
    jsonResult = Blockly.serialization.workspaces.save(Blockly.getMainWorkspace());
    localStorage.setItem("scafiBlocklyStore", JSON.stringify(jsonResult));
    window.scafiBlocklyStore = jsonResult;
}

function clearWorkspace() {
    Blockly.getMainWorkspace().clear();
    Blockly = null
}

function loadWorkspace() {
    Blockly.serialization.workspaces.load(JSON.parse(localStorage.getItem("scafiBlocklyStore")), Blockly.getMainWorkspace());
}

/**
 * Load a file
 * @param {String} filePath the path of the file.
 * @returns the content of the file.
 */
function loadFile(filePath) {
    // Make a sync get request with XHTTP
    console.log("loadFile: " + filePath);
    const xhr = new XMLHttpRequest();
    xhr.open("GET", filePath, false);
    xhr.send();
    return xhr;
}

/**
 * Load a configuration from an XML file
 * @param {String} filePath the path of the file.
 * @returns the XML Object
 */
function loadConfigurationFromXMLFile(filePath) {
    const file = loadFile(filePath);
    return file.responseText;
}

/**
 * Load a configuration from a JSON file
 * @param {String} filePath the path of the file.
 * @returns the JSON Object
 */
function loadConfigurationFromJSONFile(filePath) {
    const file = loadFile(filePath);
    return JSON.parse(file.responseText);
}

//#endregion

/**
 * Setup the initial workspace
 * @param {String} initialWorkspace the initial workspace configuration as an xml string.
 * @param {Workspace} workspace the workspace to update.
 */
function addInitialConfigurationToWorkspace(initialWorkspace, workspace) {
    Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(initialWorkspace), workspace);
}


/**
 * Add the blocks to Blockly.
 * @param {Array} library the JSON Array containing the blocks definitions.
 */
function addBlocksLibraryToBlocky(library) {
    Blockly.defineBlocksWithJsonArray(library);
}

/**
 * Add a getter after either a definition or a value block is added.
 * @param {Workspace} workspace the current workspace.
 * @returns the new block list.
 */
function dynamicallyAddGetterForFunctions(workspace) {

    const ignore = ['getter', 'call_function', 'call_function_1_param', 'call_function_2_param', 'call_function_3_param'];
    const blockList = Blockly.getMainWorkspace().getToolbox().getToolboxItems().filter(t => t.name_ == "Functions")[0].toolboxItemDef_.contents.filter(x => !ignore.some(y => y.type == x.type));

    // Get all the blocks in the workspace
    const defineBlocks = blockList.filter(x => x.type != "return").flatMap(x => workspace.getBlocksByType(x.type));

    defineBlocks.filter(x => x.type == "function").forEach(def => {
        blockList.unshift({
            'kind': 'block',
            'type': 'call_function',
            'fields': {
                'NAME': def.getFieldValue('FUNCTION_NAME'),
            },
            'data': {
                'defineBlockId': def.id,
            }
        });
    });

    defineBlocks.filter(x => x.type == "function_1_param").forEach(def => {
        blockList.unshift({
            'kind': 'block',
            'type': 'getter',
            'fields': {
                'NAME': def.getFieldValue('PARAM_NAME'),
            },
            'data': {
                'defineBlockId': def.id,
            }
        });
        blockList.unshift({
            'kind': 'block',
            'type': 'call_function_1_param',
            'fields': {
                'NAME': def.getFieldValue('FUNCTION_NAME'),
                'PARAM_NAME': def.getFieldValue('PARAM_NAME'),
            },
            'data': {
                'defineBlockId': def.id,
            }
        });
    });

    defineBlocks.filter(x => x.type == "function_2_param").forEach(def => {
        blockList.unshift({
            'kind': 'block',
            'type': 'getter',
            'fields': {
                'NAME': def.getFieldValue('PARAM_1_NAME'),
            },
            'data': {
                'defineBlockId': def.id,
            }
        });
        blockList.unshift({
            'kind': 'block',
            'type': 'getter',
            'fields': {
                'NAME': def.getFieldValue('PARAM_2_NAME'),
            },
            'data': {
                'defineBlockId': def.id,
            }
        });
        blockList.unshift({
            'kind': 'block',
            'type': 'call_function_2_param',
            'fields': {
                'NAME': def.getFieldValue('FUNCTION_NAME'),
                'PARAM_1_NAME': def.getFieldValue('PARAM_1_NAME'),
                'PARAM_2_NAME': def.getFieldValue('PARAM_2_NAME')
            },
            'data': {
                'defineBlockId': def.id,
            }
        });
    });

    defineBlocks.filter(x => x.type == "function_3_param").forEach(def => {
        blockList.unshift({
            'kind': 'block',
            'type': 'getter',
            'fields': {
                'NAME': def.getFieldValue('PARAM_1_NAME'),
            },
            'data': {
                'defineBlockId': def.id,
            }
        });
        blockList.unshift({
            'kind': 'block',
            'type': 'getter',
            'fields': {
                'NAME': def.getFieldValue('PARAM_2_NAME'),
            },
            'data': {
                'defineBlockId': def.id,
            }
        });
        blockList.unshift({
            'kind': 'block',
            'type': 'getter',
            'fields': {
                'NAME': def.getFieldValue('PARAM_3_NAME'),
            },
            'data': {
                'defineBlockId': def.id,
            }
        });
        blockList.unshift({
            'kind': 'block',
            'type': 'call_function_3_param',
            'fields': {
                'NAME': def.getFieldValue('FUNCTION_NAME'),
                'PARAM_1_NAME': def.getFieldValue('PARAM_1_NAME'),
                'PARAM_2_NAME': def.getFieldValue('PARAM_2_NAME'),
                'PARAM_3_NAME': def.getFieldValue('PARAM_3_NAME')
            },
            'data': {
                'defineBlockId': def.id,
            }
        });
    });

    defineBlocks.filter(x => x.type == "lambda_1_param").forEach(def => {
        blockList.unshift({
            'kind': 'block',
            'type': 'getter',
            'fields': {
                'NAME': def.getFieldValue('PARAM_NAME'),
            },
            'data': {
                'defineBlockId': def.id,
            }
        });
    });
    defineBlocks.filter(x => x.type == "lambda_2_param").forEach(def => {
        blockList.unshift({
            'kind': 'block',
            'type': 'getter',
            'fields': {
                'NAME': def.getFieldValue('PARAM_1_NAME'),
            },
            'data': {
                'defineBlockId': def.id,
            }
        });
        blockList.unshift({
            'kind': 'block',
            'type': 'getter',
            'fields': {
                'NAME': def.getFieldValue('PARAM_2_NAME'),
            },
            'data': {
                'defineBlockId': def.id,
            }
        });
    });
    return blockList;
};


function dynamicallyAddGetterForDefinitions(workspace) {

    const ignore = ['getter'];
    const blockList = Blockly.getMainWorkspace().getToolbox().getToolboxItems().filter(t => t.name_ == "Definitions")[0].toolboxItemDef_.contents.filter(x => !ignore.some(y => y.type == x.type));

    // Get all the blocks in the workspace
    const defineBlocks = blockList.flatMap(x => workspace.getBlocksByType(x.type));

    for (const defineBlock of defineBlocks) {
        const defName = defineBlock.getFieldValue('NAME');
        blockList.push({
            'kind': 'block',
            'type': 'getter',
            'fields': {
                'NAME': defName,
            },
            'data': {
                'defineBlockId': defineBlock.id,
            }
        });
    }
    return blockList;
}

/**
 * Create and setup the workspace.
 * @param {String} editor the editor element
 * @returns the Workspace Object
 */
function createWorkspace(editor, toolbox, initialWorkspace) {
    const workspaceConfiguration = {
        toolbox: toolbox,
    }

    const workspace = Blockly.inject(editor, workspaceConfiguration);
    if(scafiBlocklyStore !== null) {
        loadWorkspace()
    } else {
        addInitialConfigurationToWorkspace(initialWorkspace, workspace);
    }

    // Add a callback to dynamically add getter after a define block is added.
    workspace.registerToolboxCategoryCallback('Functions', dynamicallyAddGetterForFunctions);
    workspace.registerToolboxCategoryCallback('Definitions', dynamicallyAddGetterForDefinitions);

    //Disable all blocks outside the main block
    workspace.addChangeListener(Blockly.Events.disableOrphans);

    return workspace;
}



/**
 * Create the environment.
 * @param {Element} editor the editor div element.
 * @returns the created workspace
 */
Blockly.createBlockly2ScafiWorkspace = function(editor) {

    // Setup configuration file's path
    const libraryConfigurationFile = 'config/library.json'
    const toolboxConfigurationFile = 'config/toolbox.xml'
    const initialWorkspaceConfigurationFile = 'config/initialWorkspace.xml';

    // Load library, toolbox and initial workspace setup from their xml configuration file.
    const library = loadConfigurationFromJSONFile(libraryConfigurationFile);
    addBlocksLibraryToBlocky(library);

    const toolbox = loadConfigurationFromXMLFile(toolboxConfigurationFile);
    const initialWorkspace = loadConfigurationFromXMLFile(initialWorkspaceConfigurationFile);
    return createWorkspace(editor, toolbox, initialWorkspace);

}

Blockly.ScaFi = new Blockly.Generator('ScaFi');

//scrub_ is the common tasks for generating code from blocks, called on every block.
Blockly.ScaFi.scrub_ = function(block, code, opt_thisOnly) {
    const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
    let nextCode = '';
    if (nextBlock) {
        nextCode = opt_thisOnly ? '' : '\n' + Blockly.ScaFi.blockToCode(nextBlock);
    }
    return code + nextCode;
};

Blockly.ScaFi.addValueBlockGenerator = function(blockName, generator) {
    Blockly.ScaFi[blockName] = (block) => generator(block);
}
Blockly.ScaFi.addUnitBlockGenerator = function(blockName, generator) {
    Blockly.ScaFi[blockName] = (block) => generator(block)[0];
}
