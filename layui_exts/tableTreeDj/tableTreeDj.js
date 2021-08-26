layui.define(['table', 'jquery'], function(exports) {
    var MOD_NAME = 'tableTreeDj';
    var $ = layui.jquery;
    var table = layui.table;

    function Tree() {
        this.config = {
            keyId: "id" // 当前ID
            , keyPid: "pid" // 上级ID
            , title: "name" // 标题名称字段,此字段td用于绑定单击折叠展开功能
            , indent: ' &nbsp; &nbsp;' // 缩进.可以是其他字符
            // 图标
            , icon: {
                open: 'layui-icon layui-icon-triangle-d', // 展开时候图标
                close: 'layui-icon layui-icon-triangle-r', // 折叠时候图标
            }

            // 是否启用展开状态缓存
            // 传true表示启用缓存,占用 localStorage的key = unfoldStatus
            // 传具体字符串表示启用, 字符串会设置成key
            , showCache: false
            , sort: 'asc' // 排序方式.['asc', 'desc'].必须小写
            // 点击展开时候的回调函数
            ,showByPidCallback: {}

            // 点击折叠时候的回调函数
            ,hideByPidCallback: {}
            ,defaultShow: false // 全部展开,如果开启缓存,只有缓存里面没有展开状态时候此配置才生效.否则按缓存里面的展开状态来初始化数据
        };
        // 运行数据模板
        this.runTemplate = {
            hasChild: [] // 是否有子级[id=>true]
            , parentChild: {} // 父子级关系 [pid=> [id, id]]
            , level: {} // 层级 [id=>0]
            , childParent: {} // 子级与父级对应关系 [id=>pid]
            , dataIndex: {} // 表格 data-index 与 数据id 的对应关系
            , unfoldStatus: {} // id=>true ,true展开, false折叠.
            , idArr: [] // id数组
            , pidArr: [] // pid数组
        }
        // 实际运行时候的数据
        this.run = {}

        // table参数,作为中转变量,以期二次渲染的时候不用再次传入
        this.objTable = {};

        // 原始data
        this.dataOri = [];
    }

    // 渲染
    Tree.prototype.render = function(obj, config) {
        var that = this
        // 此操作是为了在多次调用render方法的时候,可以忽略obj参数
        if(!!obj) {
            this.objTable = obj;
        } else {
            obj = this.objTable;
        }
        if(obj.url == null) {
            console.error("url不可为空");
            return;
        }

        if(!!config) {
            this.config = $.extend(this.config, config);
        }

        // 整理数据初始状态
        var parseData = obj.parseData || {};
        obj.parseData = function(res) {
            if(JSON.stringify(parseData) !== "{}") {
                res = parseData(res)
            }
            that._initDo();
            res.data = that._parse(res.data);
            return res;
        }

        // 数据渲染之后,执行的操作
        var done = obj.done || {};
        obj.done = function(res, curr, count) {
            that._done(obj, res, curr, count);
            if(JSON.stringify(done) !== "{}") {
                done(res, curr, count);
            }
        }

        table.render(obj);
    }

    // 重载
    Tree.prototype.reload = function(obj, tableId) {
        this._initDo();
        tableId = tableId || this.objTable.id;
        table.reload(tableId, obj);
    }

    // 获取table对象
    Tree.prototype.getTable = function() {
        return table;
    }

    // ================ 以下方法外部也可以调用 ========================
    // 隐藏全部子级
    Tree.prototype.hideAll = function(obj) {
        var dataIndex = this.getDataIndex();
        var layId = obj.id;

        for(var id in dataIndex) {
            if(this.run.hasChild.indexOf(id) !== -1) {
                this.hideByPid(id, layId);
            }
        }
    }

    // 显示全部子级
    Tree.prototype.showAll = function(obj) {
        var dataIndex = this.getDataIndex();
        var layId = obj.id;

        for(var id in dataIndex) {
            if(this.run.hasChild.indexOf(id) !== -1) {
                this.showByPid(id, layId);
            }
        }
    }

    // 根据index获取tr
    Tree.prototype.getElemTrByIndex = function(layId, index) {
        return $("[lay-id='"+ layId +"'] table tr[data-index='"+ index +"']");
    }

    // 根据index获取td
    Tree.prototype.getElemTdByIndex = function(layId, index) {
        var title = this.getTitle();
        return $("[lay-id='"+ layId +"'] table tr[data-index='"+ index +"'] td[data-field="+ title +"]");
    }

    // 根据index获取icon
    Tree.prototype.getElemIconByIndex = function(layId, index) {
        var title = this.getTitle();
        return $("[lay-id='"+ layId +"'] table tr[data-index='"+ index +"'] td[data-field="+ title +"] div span");
    }

    // 根据父元素隐藏子元素
    Tree.prototype.hideByPid = function(id, layId) {
        var that = this
        var idArr = this.getParentChild(id);
        if(!idArr) {
            return false;
        }

        var dataIndex = this.getDataIndex();

        // 执行隐藏操作
        idArr.forEach(function(idChild) {
            var index = dataIndex[idChild];
            that.hideByDataIndex(layId, index);

            // 递归的执行下级
            that.hideByPid(idChild, layId);
        });

        // 图标改为 close
        var index = dataIndex[id];
        var iconClose = this.getIconClose();
        var elemIcon = this.getElemIconByIndex(layId, index);
        elemIcon.removeClass().addClass(iconClose);

        // 当前ID 折叠状态设为 false
        this.setUnfoldStatus(id, false);

        this._hideByPidCallback(idArr);
    }

    // 根据pid展示
    Tree.prototype.showByPid = function(id, layId) {
        var that = this
        var idArr = this.getParentChild(id);
        if(!idArr) {
            return false;
        }

        var dataIndex = this.getDataIndex();

        // 当前折叠状态, 执行展开操作
        idArr.forEach(function(idChild) {
            var index = dataIndex[idChild];
            that.showByDataIndex(layId, index);
        });

        // 更换图标
        // 图标改为 open
        var index = dataIndex[id];
        var iconOpen = this.getIconOpen();
        var elemIcon = this.getElemIconByIndex(layId, index);
        elemIcon.removeClass().addClass(iconOpen);

        // 当前ID 折叠状态设为 true
        this.setUnfoldStatus(id, true);

        // 回调函数
        this._showByPidCallback(idArr);
    }

    // 根据 data-index 隐藏一行
    Tree.prototype.hideByDataIndex = function(layId, index) {
        var elem = this.getElemTrByIndex(layId, index);
        elem.addClass('layui-hide');
    }

    // 根据 data-index 显示一行
    Tree.prototype.showByDataIndex = function(layId, index) {
        var elem = this.getElemTrByIndex(layId, index);
        elem.removeClass('layui-hide');
    }

    // ================== 获取器 ====================
    // 获取主键 key
    Tree.prototype.getDataOri = function() {
        return this.dataOri;
    }

    Tree.prototype.getKeyId = function () {
        return this.config.keyId;
    }

    // 获取上级 key
    Tree.prototype.getKeyPid = function() {
        return this.config.keyPid;
    }

    // 获取要缩进的字段
    Tree.prototype.getTitle = function() {
        return this.config.title;
    }

    // 获取缩进字符
    Tree.prototype.getIndent = function() {
        return this.config.indent;
    }

    // 获取图标开启
    Tree.prototype.getIconOpen = function() {
        return this.config.icon.open;
    }

    // 获取图标关闭
    Tree.prototype.getIconClose = function() {
        return this.config.icon.close;
    }

    // 获取层级
    Tree.prototype.getLevel = function(id) {
        if(!!id) {
            return this.run.level[id];
        }
        return this.run.level;
    }

    // 获取父子级关系
    Tree.prototype.getParentChild = function(id) {
        if(!!id) {
            return this.run.parentChild[id];
        }
        return this.run.parentChild;
    }

    // 获取 dataIndex
    Tree.prototype.getDataIndex = function() {
        return this.run.dataIndex;
    }

    // 获取是否有子级数组
    Tree.prototype.getHasChild = function() {
        return this.run.hasChild;
    }

    // 获取展开的id
    Tree.prototype.getUnfoldStatus = function(id) {
        if(!!id) {
            return this.run.unfoldStatus[id] || false;
        }
        return this.run.unfoldStatus;
    }

    // 设置展开id数据的值
    Tree.prototype.setUnfoldStatus = function(id, flag) {
        flag = flag || false;
        this.run.unfoldStatus[id] = flag;

        var cache = this.getShowCache();
        if(cache) {
            this.cache(cache, this.run.unfoldStatus);
        }
    }

    // 获取是否启用展示缓存,返回值是 缓存的 key
    Tree.prototype.getShowCache = function() {
        var cache = this.config.showCache;
        if(cache === true) {
            return "unfoldStatus";
        }
        return cache;
    }

    // 获取排序方式
    Tree.prototype.getSort = function() {
        return this.config.sort || 'asc';
    }

    // 缓存操作
    Tree.prototype.cache = function(key, val) {
        if(val) {
            val = JSON.stringify(val);
            localStorage.setItem(key, val);
        }
        return JSON.parse(localStorage.getItem(key));
    }

    // ================= 私有方法 ===================

    Tree.prototype._initDo = function() {
        // 初始化运行时配置参数
        this.run = JSON.parse(JSON.stringify(this.runTemplate));

        // 获取缓存
        var cache = this.getShowCache();
        if(cache) {
            this.run.unfoldStatus = this.cache(cache) || {};
        }
    }

    // 整理渲染时候的数据.this.run
    Tree.prototype._parseInit = function(data) {
        this.runTemplate
        var that = this
        var keyId = this.getKeyId();
        var keyPid = this.getKeyPid();

        // 将ID改为字符串,因为既当key又当value.会把整型改为字符串类型,所以这里统一改成字符串型
        for(var i=0; i<data.length; i++) {
            data[i][keyId] = data[i][keyId]+"";
            data[i][keyPid] = data[i][keyPid]+"";
        }

        // 一. 获取id数组
        data.forEach(function(obj) {
            var id = obj[keyId];
            that.run.idArr.push(id);
        });

        // 二. pid数组
        data.forEach(function(obj) {
            var pid = obj[keyPid];
            if(that.run.idArr.indexOf(pid) !== -1) {
                // 判断本条pid对应的数据是否存在
                if(that.run.pidArr.indexOf(pid) === -1) {
                    // 如果没有才添加
                    that.run.pidArr.push(pid);
                }
            }
        });

        // 三. 子级与父级 / 父级与子级 对应关系
        data.forEach(function(obj) {
            var id = obj[keyId];
            var pid = obj[keyPid];

            if(that.run.idArr.indexOf(id) !== -1 && that.run.pidArr.indexOf(pid) !== -1) {
                // 整理子级与父级对应关系
                that.run.childParent[id] = pid;

                // 整理父级与子级对应关系
                var parentChild = that.run.parentChild[pid] || [];
                parentChild.push(id);
                that.run.parentChild[pid] = parentChild;
            }
        });

        // 四. hasChild, level
        data.forEach(function(obj) {
            var id = obj[keyId];
            var pid = obj[keyPid];

            // 1. 整理 hasChild
            if(that.run.idArr.indexOf(pid) !== -1) {
                // 数据真实存在才添加到 hasChild
                // 1. 整理 hasChild 是否有子级[id1, id2, id3]
                if (that.run.hasChild.indexOf(pid) === -1) {
                    // 没有才追加
                    that.run.hasChild.push(pid);
                }
            }

            // 2. 整理 level, 根据当前向上找pid.一直找到不存在.
            var hasParent = true;
            var level = 0;
            var idCheck = id;
            while(hasParent) {
                // 判断当前父级是否存在.不存在则退出
                if(!that.run.childParent.hasOwnProperty(idCheck)) {
                    hasParent = false;
                    break;
                }

                // 获取父级ID,用于下次检测
                idCheck = that.run.childParent[idCheck];
                level++;
            }
            that.run.level[id] = level;

        });
    }

    // 开始渲染
    Tree.prototype._parseDo = function(data) {
        // 显示图标 -- 给标题增加图标span
        data = this._showIcon(data);

        // 显示缩进
        data = this._showIndent(data);

        // 排序, 使子级紧挨在父级下面
        data = this._disposalSortParent(data);
        return data;
    }

    // 数据整理(总) - 获取数据之后,渲染数据之前.
    Tree.prototype._parse = function(data) {
        if(!data) data = [];

        // 设置原始data
        this._setDataOri(data)

        // 整理渲染时候的数据.this.run
        this._parseInit(data);

        // 开始渲染
        data = this._parseDo(data)
        return data;
    }

    // 整理done之前的准备工作
    Tree.prototype._doneInit = function(data) {
        // 一点扫尾工作,必须等待整理完数据才可以执行
        // 整理 data-index 与 id 的对应关系,点击得到 data-index => $(data-index) => id; id => dataIndex[id] => data-index
        this._disposalDataIndex(data);
    }

    Tree.prototype._doneDo = function(obj, data) {
        var id = obj.id
        // 初始化展开状态, 优先根据缓存确定是否展开,缓存没有则判断是否默认展开,以上不符合则隐藏子级
        this._initShow(data, obj);

        // 给标题绑定点击事件
        this._bindTitleClick(data, id);
    }

    // 数据渲染之后,执行的操作
    Tree.prototype._done = function(obj, res, curr, count) {
        this._doneInit(res.data);
        this._doneDo(obj, res.data);
    }

    // 初始化展开状态, 根据缓存确定是否展开
    Tree.prototype._initShow = function(data, obj) {
        var layId = obj.id
        var that = this;

        // 判断是否有缓存存在
        var hasUnfold = that.getUnfoldStatus()
        if(JSON.stringify(hasUnfold) !== '{}') {
            var keyId = this.getKeyId();
            data.forEach(function(item) {
                var id = item[keyId];

                // 判断当前折叠还是展开
                var unfoldId = that.getUnfoldStatus(id);
                if(unfoldId) {
                    // 下级展开
                    that.showByPid(id, layId);
                } else {
                    // 下级折叠
                    that.hideByPid(id, layId);
                }
            });
            return;
        }

        var defaultShow = that._getDefaultShow()
        if(defaultShow) {
            // 如果缓存不存在,则判断是否配置全部展开
            that.showAll(obj)
        } else {
            // 否则全部折叠
            that.hideAll(obj)
        }
    }

    // 给标题绑定点击事件
    Tree.prototype._bindTitleClick = function(data, layId) {
        var that = this;

        var dataIndex = this.getDataIndex();
        var keyId = this.getKeyId();
        data.forEach(function(item) {
            var id = item[keyId];
            var index = dataIndex[id];
            var elem = that.getElemTdByIndex(layId, index);

            var param = {
                id: id
            }

            // 先取消后绑定.以防止重复绑定
            elem.off('click').bind('click', param, function(param) {
                var id = param.data.id;

                // 判断当前折叠还是展开
                var unfoldId = that.getUnfoldStatus(id);
                if(unfoldId) {
                    // 下级折叠
                    that.hideByPid(id, layId);
                } else {
                    // 下级展开
                    that.showByPid(id, layId);
                }
            });
        });
    }

    // 整理数据 - 整理 layui.table 行中的 data-index 与 数据id 的对应关系[id=>index]
    Tree.prototype._disposalDataIndex = function(data) {
        var dataIndex = {};
        var keyId = this.getKeyId();
        data.forEach(function(item, index) {
            var id = item[keyId];
            dataIndex[id] = index;
        })
        this.run.dataIndex = dataIndex;
    }

    // 排序 - 使子级紧挨在父级下面
    Tree.prototype._disposalSortParent = function(data) {
        var resData = [];

        var level = this.getLevel();
        var pc = this.getParentChild();
        var sort = this.getSort();

        // 1. 先排序顶级
        var dataTop = [];
        for(var key in level) {
            if(level[key] === 0) {
                if(sort === 'asc') {
                    dataTop.push(key);
                } else {
                    dataTop.splice(0, 0, key);
                }
            }
        }

        var dataTopHas = dataTop.length > 0;
        while (dataTopHas) {
            var id = dataTop[0];

            var i = this._getdataOriIndexById(id, data);
console.log(this.run);
            // 先将值取出来存入 resData 中
            resData.push(data[i]);

            // 再从 data 中删除这个元素. 注意要用完再删
            data.splice(i, 1);
            dataTop.splice(0, 1);

            var child = pc[id];
            if(child) {
                if(sort !== 'asc') {
                    child = child.reverse();
                }
                // 单个插入.所以要反向排序一下
                child = child.reverse()
                child.forEach(function(childObj) {
                    dataTop.splice(0, 0, childObj)
                })
            }

            dataTopHas = dataTop.length > 0;
        }

        return resData;
    }

    // 获取某id=x所在某个数组的位置
    Tree.prototype._getdataOriIndexById = function(id, data) {
        var keyId = this.getKeyId();
        for(var i=0; i<data.length; i++) {
            var line = data[i];
            if(line[keyId] === id) {
                return i;
            }
        }
        return false;
    }

    // 显示缩进 - 标题前面增加缩进字符串
    Tree.prototype._showIndent = function(data) {
        var that = this
        var tmp = [];

        var indent = this.getIndent();
        var level = this.getLevel();
        var keyId = this.getKeyId();

        data.forEach(function(item) {
            var id = item[keyId];
            var title = that.getTitle();
            var indentItem = '';
            for(var i=0; i<level[id]; i++) {
                indentItem = indentItem + indent
            }
            item[title] = indentItem + item[title];
            tmp.push(item);
        })
        return tmp;
    }

    // 显示图标 - 标题增加span标签
    Tree.prototype._showIcon = function(data) {
        var that = this
        var tmp = [];

        var keyId = this.getKeyId();
        var hasChild = this.getHasChild();

        data.forEach(function(item) {
            var id = item[keyId];
            var title = that.getTitle();
            var iconClose = that.getIconClose();
            if(hasChild.indexOf(id) !== -1) {
                item[title] = '<span class="'+ iconClose +'"></span>' + item[title];
            }
            tmp.push(item);
        });
        return tmp;
    }

    // 展开回调函数
    Tree.prototype._showByPidCallback = function(idArr) {
        var callback = this.config.showByPidCallback
        if(JSON.stringify(callback) !== "{}") {
            callback(idArr);
        }
    }

    // 折叠回调函数
    Tree.prototype._hideByPidCallback = function(idArr) {
        var callback = this.config.hideByPidCallback
        if(JSON.stringify(callback) !== "{}") {
            callback(idArr);
        }
    }

    // 获取是否默认展开
    Tree.prototype._getDefaultShow = function() {
        return this.config.defaultShow
    }

    Tree.prototype._setDefaultShow = function(defaultShow) {
        this.config.defaultShow = defaultShow
    }

    Tree.prototype._setDataOri = function(dataOri) {
        this.dataOri = JSON.parse(JSON.stringify(dataOri));
    }

    var obj = new Tree();
    exports(MOD_NAME, obj)
});