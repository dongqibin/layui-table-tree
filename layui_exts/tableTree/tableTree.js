layui.define(['table', 'jquery'], function (exports) {
    var MOD_NAME = 'tableTree';
    var $ = layui.jquery;
    var table = layui.table;
    var Tree = (function () {
        function Tree() {
            this.config = {
                keyId: "id" // 当前ID
                ,
                keyPid: "pid" // 上级ID
                ,
                title: "name" // 标题名称字段,此字段td用于绑定单击折叠展开功能
                ,
                indent: ' &nbsp; &nbsp;' // 缩进.可以是其他字符
                ,
                icon: {
                    open: 'layui-icon layui-icon-triangle-d',
                    close: 'layui-icon layui-icon-triangle-r'
                },
                firstSort: {} //优先排序。次级排序按pid排
                ,
                showCache: false,
                sort: 'asc' // 排序方式.['asc', 'desc'].必须小写
                ,
                showByPidCallback: {},
                hideByPidCallback: {}
            };
            // 运行数据模板
            this.runTemplate = {
                hasChild: {} // 是否有子级[id=>true]
                ,
                level: {} // 层级 [id=>0]
                ,
                parentChild: {} // 父子级关系 [pid=> [id, id]]
                ,
                dataIndex: {} // 表格 data-index 与 数据id 的对应关系
                ,
                unfoldStatus: {} // id=>true ,true展开, false折叠.
            };
            // 实际运行时候的数据
            this.run = {};
            // table参数,作为中转变量,以期二次渲染的时候不用再次传入
            this.objTable = {};
        }
        // 渲染
        Tree.prototype.render = function (obj, config) {
            var _this = this;
            // 此操作是为了在多次调用render方法的时候,可以忽略obj参数
            if (!!obj) {
                this.objTable = obj;
            }
            else {
                obj = this.objTable;
            }
            if (!!config) {
                this.config = $.extend(this.config, config);
            }
            if (obj.hasOwnProperty('initSort')) {
                this.config.firstSort.sortField = obj.initSort.field;
                this.config.firstSort.sortType = obj.initSort.type;
            }
            // 整理数据初始状态
            var parseData = obj.parseData || {};
            if (obj.url != null) {
                obj.parseData = function (res) {
                    if (JSON.stringify(parseData) !== "{}") {
                        res = parseData(res);
                    }
                    _this._sortData(res.data);
                    res.data = _this._parse(res.data);
                    return res;
                };
            }
            else if (obj.url == null && obj.hasOwnProperty('data')) {
                this._sortData(obj.data);
                obj.data = this._parse(obj.data);
            }
            // 数据渲染完成后,执行隐藏操作
            var done = obj.done || {};
            obj.done = function (res, curr, count) {
                _this._done(obj, res, curr, count);
                if (JSON.stringify(done) !== "{}") {
                    done(res, curr, count);
                }
            };
            this._initDo(obj.url == null && obj.hasOwnProperty('data'), obj);
            if (obj.hasOwnProperty('initSort')) {
                delete obj.initSort;
            }
            table.render(obj);
        };
        // 重载
        Tree.prototype.reload = function (obj, tableId) {
            if (obj.url == null && obj.hasOwnProperty('data')) {
                if (obj.hasOwnProperty('initSort')) {
                    this.config.firstSort.sortField = obj.initSort.field;
                    this.config.firstSort.sortType = obj.initSort.type;
                }
                this._sortData(obj.data);
                obj.data = this._parse(obj.data);
            }
            this._initDo(obj.url == null && obj.hasOwnProperty('data'), obj);
            tableId = tableId || this.objTable.id;
            table.reload(tableId, obj);
        };
        // 获取table对象
        Tree.prototype.getTable = function () {
            return table;
        };
        // ================ 以下方法外部也可以调用 ========================
        // 隐藏全部子级
        Tree.prototype.hideAll = function (obj) {
            var dataIndex = this.getDataIndex();
            var layId = obj.id;
            for (var id in dataIndex) {
                if (!!this.run.hasChild[id]) {
                    this.hideByPid(id, layId);
                }
            }
        };
        // 显示全部子级
        Tree.prototype.showAll = function (obj) {
            var dataIndex = this.getDataIndex();
            var layId = obj.id;
            for (var id in dataIndex) {
                if (!!this.run.hasChild[id]) {
                    this.showByPid(id, layId);
                }
            }
        };
        Tree.prototype.getElemTrByIndex = function (layId, index) {
            return $("[lay-id='" + layId + "'] table tr[data-index='" + index + "']");
        };
        Tree.prototype.getElemTdByIndex = function (layId, index) {
            var title = this.getTitle();
            return $("[lay-id='" + layId + "'] table tr[data-index='" + index + "'] td[data-field=" + title + "]");
        };
        Tree.prototype.getElemIconByIndex = function (layId, index) {
            var title = this.getTitle();
            return $("[lay-id='" + layId + "'] table tr[data-index='" + index + "'] td[data-field=" + title + "] div span");
        };
        // 根据父元素隐藏子元素
        Tree.prototype.hideByPid = function (id, layId) {
            var _this = this;
            var idArr = this.getParentChild(id);
            if (!idArr) {
                return false;
            }
            var dataIndex = this.getDataIndex();
            // 执行隐藏操作
            idArr.forEach(function (idChild) {
                var index = dataIndex[idChild];
                _this.hideByDataIndex(layId, index);
                // 递归的执行下级
                _this.hideByPid(idChild, layId);
            });
            // 图标改为 close
            var index = dataIndex[id];
            var iconClose = this.getIconClose();
            var elemIcon = this.getElemIconByIndex(layId, index);
            elemIcon.removeClass().addClass(iconClose);
            // 当前ID 折叠状态设为 false
            this.setUnfoldStatus(id, false);
            this._hideByPidCallback(idArr);
        };
        Tree.prototype.showByPid = function (id, layId) {
            var _this = this;
            var idArr = this.getParentChild(id);
            if (!idArr) {
                return false;
            }
            var dataIndex = this.getDataIndex();
            // 当前折叠状态, 执行展开操作
            idArr.forEach(function (idChild) {
                var index = dataIndex[idChild];
                _this.showByDataIndex(layId, index);
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
        };
        // 根据 data-index 隐藏一行
        Tree.prototype.hideByDataIndex = function (layId, index) {
            var elem = this.getElemTrByIndex(layId, index);
            elem.addClass('layui-hide');
        };
        // 根据 data-index 显示一行
        Tree.prototype.showByDataIndex = function (layId, index) {
            var elem = this.getElemTrByIndex(layId, index);
            elem.removeClass('layui-hide');
        };
        // 根据 id 获取 索引
        Tree.prototype.getIndexById = function (data, id) {
            var keyId = this.getKeyId();
            for (var i = 0; i < data.length; i++) {
                if (data[i][keyId] === id) {
                    return i + 1;
                }
            }
            return 0;
        };
        // ================== 获取器 ====================
        // 获取主键 key
        Tree.prototype.getKeyId = function () {
            return this.config.keyId;
        };
        // 获取上级 key
        Tree.prototype.getKeyPid = function () {
            return this.config.keyPid;
        };
        // 获取要缩进的字段
        Tree.prototype.getTitle = function () {
            return this.config.title;
        };
        // 获取缩进字符
        Tree.prototype.getIndent = function () {
            return this.config.indent;
        };
        // 获取图标开启
        Tree.prototype.getIconOpen = function () {
            return this.config.icon.open;
        };
        // 获取图标关闭
        Tree.prototype.getIconClose = function () {
            return this.config.icon.close;
        };
        // 获取层级
        Tree.prototype.getLevel = function (id) {
            if (!!id) {
                return this.run.level[id];
            }
            return this.run.level;
        };
        // 获取父子级关系
        Tree.prototype.getParentChild = function (id) {
            if (!!id) {
                return this.run.parentChild[id];
            }
            return this.run.parentChild;
        };
        // 获取 dataIndex
        Tree.prototype.getDataIndex = function () {
            return this.run.dataIndex;
        };
        // 获取是否有子级数组
        Tree.prototype.getHasChild = function () {
            return this.run.hasChild;
        };
        // 获取展开的id
        Tree.prototype.getUnfoldStatus = function (id) {
            if (!!id) {
                return this.run.unfoldStatus[id] || false;
            }
            return this.run.unfoldStatus;
        };
        // 设置展开id数据的值
        Tree.prototype.setUnfoldStatus = function (id, flag) {
            flag = flag || false;
            this.run.unfoldStatus[id] = flag;
            var cache = this.getShowCache();
            if (cache) {
                this.cache(cache, this.run.unfoldStatus);
            }
        };
        // 获取是否启用展示缓存,返回值是 缓存的 key
        Tree.prototype.getShowCache = function () {
            var cache = this.config.showCache;
            if (cache === true) {
                return "unfoldStatus";
            }
            return cache;
        };
        // 获取排序方式
        Tree.prototype.getSort = function () {
            return this.config.sort || 'asc';
        };
        // 缓存操作
        Tree.prototype.cache = function (key, val) {
            if (val) {
                val = JSON.stringify(val);
                localStorage.setItem(key, val);
            }
            return JSON.parse(localStorage.getItem(key));
        };
        // ================= 私有方法 ===================
        Tree.prototype._initDo = function (localData) {
            if (!localData) {
                // 初始化运行时配置参数
                this.run = JSON.parse(JSON.stringify(this.runTemplate));
            }
            else {
                this.run.unfoldStatus = {};
            }
            var cache = this.getShowCache();
            if (cache) {
                this.run.unfoldStatus = this.cache(cache) || {};
            }
        };
        Tree.prototype._sortData = function (data) {
            if (this.config.firstSort.sortField === undefined) {
                return;
            }
            var sortField = this.config.firstSort.sortField;
            var sortType = this.config.firstSort.sortType;
            if (sortField !== undefined) {
                data.sort(function (a, b) {
                    // noinspection EqualityComparisonWithCoercionJS
                    var compare = a[sortField] == b[sortField] ? 0 : a[sortField] > b[sortField] ? 1 : -1;
                    return sortType === 'desc' ? compare * -1 : compare;
                });
            }
        };
        // 数据整理(总) - 获取数据之后,渲染数据之前.
        Tree.prototype._parse = function (data) {
            if (data.length === 0)
                return [];
            // 按 pid 排序
            var keyPid = this.getKeyPid();
            data.sort(function (a, b) {
                // noinspection EqualityComparisonWithCoercionJS
                return a[keyPid] == b[keyPid] ? 0 : a[keyPid] > b[keyPid] ? 1 : -1;
            });
            // 计算子级
            this._disposalHasChild(data);
            // 显示图标 -- 给标题增加图标span
            data = this._showIcon(data);
            // 计算最小pid当做顶级.因为某种情况下.顶级的pid不一定是0
            this._minPid(data);
            // 计算层级
            this._disposalLevel(data);
            // 缩进显示
            data = this._showIndent(data);
            // 整理父子级关系,只有两级,毕竟点击上级只展开下级.下级的下级并没有展开的需求
            this._disposalParentChild(data);
            // 排序, 使子级紧挨在父级下面
            data = this._disposalSortParent(data);
            // 整理 data-index 与 id 的对应关系,点击得到 data-index => $(data-index) => id; id => dataIndex[id] => data-index
            this._disposalDataIndex(data);
            return data;
        };
        // 计算最小pid.因为某些情况下.最小pid不一定是0
        Tree.prototype._minPid = function (data) {
            this.run.minPid = data[0][this.getKeyPid()] || 0;
        };
        // 数据渲染之后,执行的操作
        Tree.prototype._done = function (obj, res, curr, count) {
            // 初始化展开状态, 根据缓存确定是否展开,缓存没有则隐藏子级
            this._initShow(res.data, obj.id);
            // 给标题绑定点击事件
            this._bindTitleClick(res.data, obj);
        };
        // 初始化展开状态, 根据缓存确定是否展开
        Tree.prototype._initShow = function (data, layId) {
            var that = this;
            var keyId = this.getKeyId();
            data.forEach(function (item) {
                var id = item[keyId];
                // 判断当前折叠还是展开
                var unfoldId = that.getUnfoldStatus(id);
                if (unfoldId) {
                    // 下级展开
                    that.showByPid(id, layId);
                }
                else {
                    if (item.hasOwnProperty('open') && item.open === true) {
                        // 下级展开
                        that.showByPid(id, layId);
                    }
                    else {
                        // 下级折叠
                        that.hideByPid(id, layId);
                    }
                }
            });
        };
        // 给标题绑定点击事件
        Tree.prototype._bindTitleClick = function (data, obj) {
            var _this = this;
            var that = this;
            var dataIndex = this.getDataIndex();
            var keyId = this.getKeyId();
            var layId = obj.id;
            data.forEach(function (item) {
                var id = item[keyId];
                var index = dataIndex[id];
                var elem = _this.getElemTdByIndex(layId, index);
                var param = {
                    id: id,
                    index: index
                };
                // 先取消后绑定.以防止重复绑定
                elem.off('click').bind('click', param, function (param) {
                    var id = param.data.id;
                    // 判断当前折叠还是展开
                    var unfoldId = that.getUnfoldStatus(id);
                    if (unfoldId) {
                        // 下级折叠
                        that.hideByPid(id, layId);
                    }
                    else {
                        // 下级展开
                        that.showByPid(id, layId);
                    }
                });
            });
        };
        // 整理数据 - 整理 layui.table 行中的 data-index 与 数据id 的对应关系[id=>index]
        Tree.prototype._disposalDataIndex = function (data) {
            var dataIndex = {};
            var keyId = this.getKeyId();
            data.forEach(function (item, index) {
                var id = item[keyId];
                dataIndex[id] = index;
            });
            this.run.dataIndex = dataIndex;
        };
        // 整理数据 - 整理父子级关系 [pid => [id, id]]
        Tree.prototype._disposalParentChild = function (data) {
            var _this = this;
            var parentChild = {};
            var keyId = this.getKeyId();
            var keyPid = this.getKeyPid();
            data.forEach(function (item) {
                var id = item[keyId];
                var pid = item[keyPid];
                if (pid !== _this.run.minPid) {
                    var parent = parentChild[pid] || [];
                    parent.push(id);
                    parentChild[pid] = parent;
                }
            });
            this.run.parentChild = parentChild;
        };
        // 排序 - 使子级紧挨在父级下面
        Tree.prototype._disposalSortParent = function (data) {
            var _this = this;
            var resData = [];
            var level = this.getLevel();
            var pc = this.getParentChild();
            var sort = this.getSort();
            var dataTop = [];
            for (var key in level) {
                if (level[key] == 0) {
                    if (sort === 'asc') {
                        dataTop.push(key);
                    }
                    else {
                        dataTop.splice(0, 0, key);
                    }
                }
            }
            var dataMap = {};
            data.forEach(function (item) {
                dataMap[item[_this.getKeyId()]] = item;
            });
            var dataTopHas = dataTop.length > 0;
            while (dataTopHas) {
                var id = dataTop[0];
                var i = this._getdataOriIndexById(id, data);
                if (i === undefined) {
                    dataTop.splice(0, 1);
                    dataTopHas = dataTop.length > 0;
                    continue;
                }
                // 先将值取出来存入 resData 中
                resData.push(data[i]);
                // 再从 data 中删除这个元素. 注意要用完再删
                data.splice(i, 1);
                dataTop.splice(0, 1);
                var child = pc[id];
                if (child) {
                    if (this.config.firstSort.sortField) {
                        var childrenData = [];
                        child.forEach(function (childData) {
                            childrenData.push(dataMap[childData]);
                        });
                        this._sortData(childrenData);
                    }
                    else {
                        child.sort(function (a, b) {
                            var compare = a == b ? 0 : a > b ? 1 : -1;
                            return sort === 'desc' ? compare * -1 : compare;
                        });
                    }
                    dataTop.splice.apply(dataTop, [0, 0].concat(child));
                }
                dataTopHas = dataTop.length > 0;
            }
            return resData;
        };
        // 获取某id=x所在某个数组的位置
        Tree.prototype._getdataOriIndexById = function (id, data) {
            var keyId = this.getKeyId();
            for (var i = 0; i < data.length; i++) {
                var line = data[i];
                // 存在数据id为数字时，level的key为字符串，用恒等会导致判断出错
                // noinspection EqualityComparisonWithCoercionJS
                if (line[keyId] == id) {
                    return i;
                }
            }
            return undefined;
        };
        // 显示缩进 - 标题前面增加缩进字符串
        Tree.prototype._showIndent = function (data) {
            var _this = this;
            var tmp = [];
            var indent = this.getIndent();
            var level = this.getLevel();
            var keyId = this.getKeyId();
            data.forEach(function (item) {
                var id = item[keyId];
                var title = _this.getTitle();
                for (var i = 0; i < level[id]; i++) {
                    item[title] = indent + item[title];
                }
                tmp.push(item);
            });
            return tmp;
        };
        // 整理数据 - 层级[id=>level]
        Tree.prototype._disposalLevel = function (data) {
            var _this = this;
            var level = {}; // id => level
            var keyId = this.getKeyId();
            var keyPid = this.getKeyPid();
            var levelData = {};
            data.forEach(function (item) {
                levelData[item[keyId]] = item;
            });
            var getLevel = function (itemId, currentLevel) {
                if (levelData[itemId] != null) {
                    currentLevel += 1;
                    return getLevel(levelData[itemId][keyPid], currentLevel);
                }
                return currentLevel;
            };
            data.forEach(function (item) {
                var id = item[keyId];
                var pid = item[keyPid];
                if (pid === _this.run.minPid) {
                    // 如果是顶级,则直接加入到 level 中
                    level[id] = 0;
                }
                else {
                    // 如果不是顶级, 从 level 中取上级的level, 加1 存入 level 中
                    level[id] = getLevel(pid, 0);
                }
            });
            this.run.level = level;
        };
        // 显示图标 - 标题增加span标签
        Tree.prototype._showIcon = function (data) {
            var _this = this;
            var tmp = [];
            var keyId = this.getKeyId();
            var hasChild = this.getHasChild();
            data.forEach(function (item) {
                var id = item[keyId];
                var title = _this.getTitle();
                var iconClose = _this.getIconClose();
                if (hasChild[id]) {
                    item[title] = '<span class="' + iconClose + '"></span>' + item[title];
                }
                tmp.push(item);
            });
            return tmp;
        };
        // 整理数据 - 某数据是否有子级
        Tree.prototype._disposalHasChild = function (data) {
            var hasChild = {};
            var keyId = this.getKeyId();
            var keyPid = this.getKeyPid();
            data.forEach(function (item) {
                var id = item[keyId];
                var pid = item[keyPid];
                //hasChild[id] = false; // 在顺序混乱的情况下.会出现id=false覆盖pid=true的情况.id=pid的情况下.
                hasChild[pid] = true;
            });
            this.run.hasChild = hasChild;
        };
        // 展开回调函数
        Tree.prototype._showByPidCallback = function (idArr) {
            var callback = this.config.showByPidCallback;
            if (JSON.stringify(callback) !== "{}") {
                callback(idArr);
            }
        };
        // 折叠回调函数
        Tree.prototype._hideByPidCallback = function (idArr) {
            var callback = this.config.hideByPidCallback;
            if (JSON.stringify(callback) !== "{}") {
                callback(idArr);
            }
        };
        return Tree;
    })();
    var obj = new Tree();
    exports(MOD_NAME, obj);
});
