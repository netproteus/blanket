var inBrowser = typeof window !== 'undefined' && this === window;
var parseAndModify = (inBrowser ? window.falafel : require("falafel"));

(inBrowser ? window : exports).blanket = (function(){
    var linesToAddTracking = [
        "ExpressionStatement",
        "BreakStatement"   ,
        "ContinueStatement" ,
        "VariableDeclaration",
        "ReturnStatement"   ,
        "ThrowStatement"   ,
        "TryStatement"     ,
        "FunctionDeclaration"    ,
        "IfStatement"       ,
        "WhileStatement"    ,
        "DoWhileStatement"   ,
        "ForStatement"   ,
        "ForInStatement"  ,
        "SwitchStatement"  ,
        "WithStatement"
    ],
    linesToAddBrackets = [
        "IfStatement"       ,
        "WhileStatement"    ,
        "DoWhileStatement"     ,
        "ForStatement"   ,
        "ForInStatement"  ,
        "WithStatement"
    ],
    linesToAddBranchTracking = [
        "IfStatement",
        "SwitchCase",
        "ConditionalExpression"
    ],
    __blanket,
    copynumber = Math.floor(Math.random()*1000),
    coverageInfo = {},options = {
        reporter: null,
        adapter:null,
        filter: null,
        customVariable: null,
        loader: null,
        ignoreScriptError: false,
        existingRequireJS:false,
        autoStart: false,
        timeout: 180,
        ignoreCors: false,
        branchTracking: false,
        sourceURL: false,
        debug:false,
        engineOnly:false,
        testReadyCallback:null,
        commonJS:false,
        instrumentCache:false,
        modulePattern: null
    };
    
    if (inBrowser && typeof window.blanket !== 'undefined'){
        __blanket = window.blanket.noConflict();
    }
    
    _blanket = {
        noConflict: function(){
            if (__blanket){
                return __blanket;
            }
            return _blanket;
        },
        _getCopyNumber: function(){
            //internal method
            //for differentiating between instances
            return copynumber;
        },
        extend: function(obj) {
            //borrowed from underscore
            _blanket._extend(_blanket,obj);
        },
        _extend: function(dest,source){
          if (source) {
            for (var prop in source) {
              if ( dest[prop] instanceof Object && typeof dest[prop] !== "function"){
                _blanket._extend(dest[prop],source[prop]);
              }else{
                  dest[prop] = source[prop];
              }
            }
          }
        },
        getCovVar: function(){
            var opt = _blanket.options("customVariable");
            if (opt){
                if (_blanket.options("debug")) {console.log("BLANKET-Using custom tracking variable:",opt);}
                return inBrowser ? "window."+opt : opt;
            }
            return inBrowser ?   "window._$blanket" : "_$jscoverage";
        },
        options: function(key,value){
            if (typeof key !== "string"){
                _blanket._extend(options,key);
            }else if (typeof value === 'undefined'){
                return options[key];
            }else{
                options[key]=value;
            }
        },
        instrument: function(config, next){
            //check instrumented hash table,
            //return instrumented code if available.
            var inFile = config.inputFile,
                inFileName = config.inputFileName;
            //check instrument cache
           if (_blanket.options("instrumentCache") && sessionStorage && sessionStorage.getItem("blanket_instrument_store-"+inFileName)){
                if (_blanket.options("debug")) {console.log("BLANKET-Reading instrumentation from cache: ",inFileName);}
                next(sessionStorage.getItem("blanket_instrument_store-"+inFileName));
            }else{
                var sourceArray = _blanket._prepareSource(inFile);
                _blanket._trackingArraySetup=[];
                //remove shebang
                inFile = inFile.replace(/^\#\!.*/, "");
                var instrumented =  parseAndModify(inFile,{loc:true,comment:true}, _blanket._addTracking(inFileName));
                instrumented = _blanket._trackingSetup(inFileName,sourceArray)+instrumented;
                if (_blanket.options("sourceURL")){
                    instrumented += "\n//@ sourceURL="+inFileName.replace("http://","");
                }
                if (_blanket.options("debug")) {console.log("BLANKET-Instrumented file: ",inFileName);}
                if (_blanket.options("instrumentCache") && sessionStorage){
                    if (_blanket.options("debug")) {console.log("BLANKET-Saving instrumentation to cache: ",inFileName);}
                    sessionStorage.setItem("blanket_instrument_store-"+inFileName,instrumented);
                }
                next(instrumented);
            }
        },
        _trackingArraySetup: [],
        _branchingArraySetup: [],
        _functionSetup: {},
        _branchSetup: {},
        _prepareSource: function(source){
            return source.replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/(\r\n|\n|\r)/gm,"\n").split('\n');
        },
        _trackingSetup: function(filename,sourceArray){
            var branches = _blanket.options("branchTracking");
            var sourceString = sourceArray.join("',\n'");
            var intro = "";
            var covVar = _blanket.getCovVar();

            intro += "if (typeof "+covVar+" === 'undefined') "+covVar+" = {};\n";
            if (branches){
                intro += "var _$branchFcn=function(f,l,c,r){ ";
                intro += "if (!!r) { ";
                intro += covVar+"[f].branchData[l][c][0] = "+covVar+"[f].branchData[l][c][0] || [];";
                intro += covVar+"[f].branchData[l][c][0].push(r); }";
                intro += "else { ";
                intro += covVar+"[f].branchData[l][c][1] = "+covVar+"[f].branchData[l][c][1] || [];";
                intro += covVar+"[f].branchData[l][c][1].push(r); }";
                intro += "return r;};\n";

                intro +=
                 "var _$branchTrack = function(filename, lineNumber, branchId, branchCount, branchCase) {" +
                 "    var coverVar = " + covVar + ";" +
                 "    coverVar[filename].branchTracks = coverVar[filename].branchTracks || {};" +
                 "    coverVar[filename].branchTracks[lineNumber] = coverVar[filename].branchTracks[lineNumber] || {};" +
                 "    var counts = coverVar[filename].branchTracks[lineNumber][branchId];" +
                 "    if (!counts) {" +
                 "        counts = Array.apply(null, new Array(branchCount)).map(Number.prototype.valueOf,0);" +
                 "        coverVar[filename].branchTracks[lineNumber][branchId] = counts;" +
                 "    }" +
                 "    if (Object.prototype.toString.call(branchCase) === '[object Number]') {" +
                 "        counts[branchCase]++;" +
                 "    }" +
                 "    else {" +
                 "        branchCase = !!branchCase;" +
                 "        counts[branchCase ? 0 : 1]++;" +
                 "    }" +
                 "    return branchCase;" +
                 "};\n";

                intro +=
                "    var _$functionTrack = function(filename, lineNumber, name) {" +
                "    var coverVar = " + covVar + ";" +
                "    coverVar[filename].functionTracks = coverVar[filename].functionTracks || {};" +
                "    coverVar[filename].functionTracks[lineNumber] = coverVar[filename].functionTracks[lineNumber] || {name: name, count: 0};" +
                "    coverVar[filename].functionTracks[lineNumber].count++;" +
                "};\n";
            }
            intro += "if (typeof "+covVar+"['"+filename+"'] === 'undefined'){";

            intro += covVar+"['"+filename+"']=[];\n";
            if (branches){
                intro += covVar+"['"+filename+"'].branchData=[];\n";
            }
            intro += covVar+"['"+filename+"'].source=['"+sourceString+"'];\n";
            //initialize array values
            _blanket._trackingArraySetup.sort(function(a,b){
                return parseInt(a,10) > parseInt(b,10);
            }).forEach(function(item){
                intro += covVar+"['"+filename+"']["+item+"]=0;\n";
            });
            if (branches){
                _blanket._branchingArraySetup.sort(function(a,b){
                    return a.line > b.line;
                }).sort(function(a,b){
                    return a.column > b.column;
                }).forEach(function(item){
                    if (item.file === filename){
                        intro += "if (typeof "+ covVar+"['"+filename+"'].branchData["+item.line+"] === 'undefined'){\n";
                        intro += covVar+"['"+filename+"'].branchData["+item.line+"]=[];\n";
                        intro += "}";
                        intro += covVar+"['"+filename+"'].branchData["+item.line+"]["+item.column+"] = [];\n";
                        intro += covVar+"['"+filename+"'].branchData["+item.line+"]["+item.column+"].consequent = "+JSON.stringify(item.consequent)+";\n";
                        intro += covVar+"['"+filename+"'].branchData["+item.line+"]["+item.column+"].alternate = "+JSON.stringify(item.alternate)+";\n";
                    }
                });

                Object.keys(_blanket._functionSetup[filename]).map(function(lineNumber){
                    intro +=
                    "    (function() {" +
                    "        var coverVar = " + covVar + ";" +
                    "        coverVar['" + filename + "'].functionTracks = coverVar['" + filename + "'].functionTracks || {};" +
                    "        coverVar['" + filename + "'].functionTracks[" + lineNumber + "] = " + JSON.stringify(_blanket._functionSetup[filename][lineNumber]) + ";" +
                    "    }());\n";
                });

                Object.keys(_blanket._branchSetup[filename]).map(function(lineNumber){
                    Object.keys(_blanket._branchSetup[filename][lineNumber]).map(function(colNumber) {
                        intro +=
                        "    (function() {" +
                        "        var coverVar = " + covVar + ";" +
                        "        coverVar['" + filename + "'].branchTracks = coverVar['" + filename + "'].branchTracks || {};" +
                        "        coverVar['" + filename + "'].branchTracks[" + lineNumber + "] = coverVar['" + filename + "'].branchTracks[" + lineNumber + "] || {};" +
                        "        coverVar['" + filename + "'].branchTracks[" + lineNumber + "][" + colNumber + "] = Array.apply(null, new Array(" + _blanket._branchSetup[filename][lineNumber][colNumber] + ")).map(Number.prototype.valueOf,0);" +
                        "    }());\n";
                    });
                });
            }
            intro += "}\n";

            return intro;
        },
        _blockifyIf: function(node){
            if (linesToAddBrackets.indexOf(node.type) > -1){
                var bracketsExistObject = node.consequent || node.body;
                var bracketsExistAlt = node.alternate;
                if( bracketsExistAlt && bracketsExistAlt.type !== "BlockStatement") {
                    bracketsExistAlt.update("{\n"+bracketsExistAlt.source()+"}\n");
                }
                if( bracketsExistObject && bracketsExistObject.type !== "BlockStatement") {
                    bracketsExistObject.update("{\n"+bracketsExistObject.source()+"}\n");
                }
            }
        },
        _trackBranch: function(node,filename){
            //recursive on consequent and alternative
            var line = node.loc.start.line;
            var col = node.loc.start.column;

            _blanket._branchingArraySetup.push({
                line: line,
                column: col,
                file:filename,
                consequent: node.consequent.loc,
                alternate: node.alternate.loc
            });

            var updated = "_$branchFcn"+
                          "('"+filename+"',"+line+","+col+","+node.test.source()+
                          ")?"+node.consequent.source()+":"+node.alternate.source();
            node.update(updated);
        },
        _trackBranch2: function(node, filename) {
            var line, col, branchCase, updated, branchCount = 2;
            if (node.type === 'SwitchCase') {
                line = node.parent.loc.start.line;
                col = node.parent.loc.start.column;
            }
            else {
                line = node.loc.start.line;
                col = node.loc.start.column;
            }

            var fileRecord = (_blanket._branchSetup[filename] = (_blanket._branchSetup[filename] || {}));
            var lineRecord = (fileRecord[line] = fileRecord[line] || {});
            lineRecord[col] = branchCount;

            switch (node.type) {
                case 'SwitchCase':
                    branchCase = node.parent.cases.indexOf(node);
                    branchCount = node.parent.cases.length;
                    // update for SwitchCase
                    lineRecord[col] = branchCount;

                    updated = node.test ? "case " + node.test.source() + ":\n" : "default :\n";
                    updated += "_$branchTrack('" + filename + "'," + line + "," + col + "," + branchCount + "," + branchCase + ");\n";
                    node.consequent.map(function(consequent) {
                        updated += consequent.source();
                        updated += "\n";
                    });

                    break;
                case 'ConditionalExpression':

                    updated = "_$branchTrack('" + filename + "'," + line + "," + col + "," + branchCount + "," + node.test.source() + ") ? ";
                    updated += node.consequent.source() + ":";
                    updated += node.alternate.source() + "\n";

                    break;
                case 'IfStatement':

                    node.test.update("_$branchTrack('" + filename + "'," + line + "," + col + "," + branchCount + "," + node.test.source() + ")");
                    // we just update the test so return;
                    return;
            }

            node.update(updated);

        },
        _trackFunction: function(node, filename) {
            var line = node.loc.start.line;
            var name = (node.id && node.id.name) || "anonymous";

            var updatedBody = "{_$functionTrack('" + filename + "'," + line + ",'" + line + "_" + name + "');\n";

            if (node.body.body) {
                node.body.body.map(function(body) {
                    updatedBody += body.source();
                    updatedBody += "\n";
                });
            }

            updatedBody += "}\n";

            node.body.update(updatedBody);

            var fileRecord = (_blanket._functionSetup[filename] = (_blanket._functionSetup[filename] || {}));
            fileRecord[line] = {name: line + "_" + name, count: 0};
        },
        _addTracking: function (filename) {
            //falafel doesn't take a file name
            //so we include the filename in a closure
            //and return the function to falafel
            var covVar = _blanket.getCovVar();

            return function(node){
                _blanket._blockifyIf(node);

                if (_blanket.options("branchTracking") && linesToAddBranchTracking.indexOf(node.type) > -1) {
                    _blanket._trackBranch2(node, filename);
                }

                if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
                    _blanket._trackFunction(node, filename);
                }

                if (linesToAddTracking.indexOf(node.type) > -1 && node.parent.type !== "LabeledStatement") {
                    _blanket._checkDefs(node,filename);
                    if (node.type === "VariableDeclaration" &&
                        (node.parent.type === "ForStatement" || node.parent.type === "ForInStatement")){
                        return;
                    }
                    if (node.loc && node.loc.start){
                        node.update(covVar+"['"+filename+"']["+node.loc.start.line+"]++;\n"+node.source());
                        _blanket._trackingArraySetup.push(node.loc.start.line);
                    }else{
                        //I don't think we can handle a node with no location
                        throw new Error("The instrumenter encountered a node with no location: "+Object.keys(node));
                    }
                }else if (_blanket.options("branchTracking") && node.type === "ConditionalExpression"){
                    // _blanket._trackBranch(node,filename);
                }
            };
        },
        _checkDefs: function(node,filename){
            // Make sure developers don't redefine window. if they do, inform them it is wrong.
            if (inBrowser){
                if (node.type === "VariableDeclaration" && node.declarations) {
                    node.declarations.forEach(function(declaration) {
                        if (declaration.id.name === "window") {
                            throw new Error("Instrumentation error, you cannot redefine the 'window' variable in  " + filename + ":" + node.loc.start.line);
                        }
                    });
                }
                if (node.type === "FunctionDeclaration" && node.params) {
                    node.params.forEach(function(param) {
                        if (param.name === "window") {
                            throw new Error("Instrumentation error, you cannot redefine the 'window' variable in  " + filename + ":" + node.loc.start.line);
                        }
                    });
                }
                //Make sure developers don't redefine the coverage variable
                if (node.type === "ExpressionStatement" &&
                    node.expression && node.expression.left &&
                    node.expression.left.object && node.expression.left.property &&
                    node.expression.left.object.name +
                        "." + node.expression.left.property.name === _blanket.getCovVar()) {
                    throw new Error("Instrumentation error, you cannot redefine the coverage variable in  " + filename + ":" + node.loc.start.line);
                }
            }else{
                //Make sure developers don't redefine the coverage variable in node
                if (node.type === "ExpressionStatement" &&
                    node.expression && node.expression.left &&
                    !node.expression.left.object && !node.expression.left.property &&
                    node.expression.left.name === _blanket.getCovVar()) {
                    throw new Error("Instrumentation error, you cannot redefine the coverage variable in  " + filename + ":" + node.loc.start.line);
                }
            }
        },
        setupCoverage: function(){
            coverageInfo.instrumentation = "blanket";
            coverageInfo.stats = {
                "suites": 0,
                "tests": 0,
                "passes": 0,
                "pending": 0,
                "failures": 0,
                "start": new Date()
            };
        },
        _checkIfSetup: function(){
            if (!coverageInfo.stats){
                throw new Error("You must call blanket.setupCoverage() first.");
            }
        },
        onTestStart: function(){
            if (_blanket.options("debug")) {console.log("BLANKET-Test event started");}
            this._checkIfSetup();
            coverageInfo.stats.tests++;
            coverageInfo.stats.pending++;
        },
        onTestDone: function(total,passed){
            this._checkIfSetup();
            if(passed === total){
                coverageInfo.stats.passes++;
            }else{
                coverageInfo.stats.failures++;
            }
            coverageInfo.stats.pending--;
        },
        onModuleStart: function(){
            this._checkIfSetup();
            coverageInfo.stats.suites++;
        },
        onTestsDone: function(){
            if (_blanket.options("debug")) {console.log("BLANKET-Test event done");}
            this._checkIfSetup();
            coverageInfo.stats.end = new Date();

            if (inBrowser){
                this.report(coverageInfo);
            }else{
                if (!_blanket.options("branchTracking")){
                    delete (inBrowser ? window : global)[_blanket.getCovVar()].branchFcn;
                }
                this.options("reporter").call(this,coverageInfo);
            }
        }
    };
    return _blanket;
})();
