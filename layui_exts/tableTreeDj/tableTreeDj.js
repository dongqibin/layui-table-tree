layui.define(['table', 'jquery'], function(exports) {
    const MOD_NAME = 'tableTreeDj';
    const $ = layui.jquery;
    const table = layui.table;

    class Tree {
        constructor() {
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
            };
            // 运行数据模板
            this.runTemplate = {
                hasChild: {} // 是否有子级[id=>true]
                , level: {} // 层级 [id=>0]
                , parentChild: {} // 父子级关系 [pid=> [id, id]]
                , dataIndex: {} // 表格 data-index 与 数据id 的对应关系
                , unfoldStatus: {} // id=>true ,true展开, false折叠.
            }
            // 实际运行时候的数据
            this.run = {}

            // table参数,作为中转变量,以期二次渲染的时候不用再次传入
            this.objTable = {};
        }


        // 渲染
        render(obj, config) {
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
            const parseData = obj.parseData || {};
            obj.parseData = (res) => {
                if(JSON.stringify(parseData) !== "{}") {
                    res = parseData(res)
                }
                res.data = this._parse(res.data);
                return res;
            }

            // 数据渲染完成后,执行隐藏操作
            const done = obj.done || {};
            obj.done = (res, curr, count) => {
                this._done(obj, res, curr, count);
                if(JSON.stringify(done) !== "{}") {
                    done(res, curr, count);
                }
            }

            this._initDo();
            table.render(obj);
        }

        // 重载
        reload(obj, tableId) {
            this._initDo();
            tableId = tableId || this.objTable.id;
            table.reload(tableId, obj);
        }

        // 获取table对象
        getTable() {
            return table;
        }


        // ================ 以下方法外部也可以调用 ========================

        // 隐藏全部子级
        hideAll(obj) {
            const dataIndex = this.getDataIndex();
            const layId = obj.id;

            for(let id in dataIndex) {
                if(!!this.run.hasChild[id]) {
                    this.hideByPid(id, layId);
                }
            }
        }

        // 显示全部子级
        showAll(obj) {
            const dataIndex = this.getDataIndex();
            const layId = obj.id;

            for(let id in dataIndex) {
                if(!!this.run.hasChild[id]) {
                    this.showByPid(id, layId);
                }
            }
        }

        getElemTrByIndex(layId, index) {
            return $("[lay-id='"+ layId +"'] table tr[data-index='"+ index +"']");
        }

        getElemTdByIndex(layId, index) {
            const title = this.getTitle();
            return $("[lay-id='"+ layId +"'] table tr[data-index='"+ index +"'] td[data-field="+ title +"]");
        }

        getElemIconByIndex(layId, index) {
            const title = this.getTitle();
            return $("[lay-id='"+ layId +"'] table tr[data-index='"+ index +"'] td[data-field="+ title +"] div span");
        }

        // 根据父元素隐藏子元素
        hideByPid(id, layId) {
            const idArr = this.getParentChild(id);
            if(!idArr) {
                return false;
            }

            const dataIndex = this.getDataIndex();

            // 执行隐藏操作
            idArr.forEach((idChild) => {
                const index = dataIndex[idChild];
                this.hideByDataIndex(layId, index);

                // 递归的执行下级
                this.hideByPid(idChild, layId);
            });

            // 图标改为 close
            const index = dataIndex[id];
            const iconClose = this.getIconClose();
            const elemIcon = this.getElemIconByIndex(layId, index);
            elemIcon.removeClass().addClass(iconClose);

            // 当前ID 折叠状态设为 false
            this.setUnfoldStatus(id, false);

            this._hideByPidCallback(idArr);
        }

        showByPid(id, layId) {
            const idArr = this.getParentChild(id);
            if(!idArr) {
                return false;
            }

            const dataIndex = this.getDataIndex();

            // 当前折叠状态, 执行展开操作
            idArr.forEach((idChild) => {
                const index = dataIndex[idChild];
                this.showByDataIndex(layId, index);
            });

            // 更换图标
            // 图标改为 open
            const index = dataIndex[id];
            const iconOpen = this.getIconOpen();
            const elemIcon = this.getElemIconByIndex(layId, index);
            elemIcon.removeClass().addClass(iconOpen);

            // 当前ID 折叠状态设为 true
            this.setUnfoldStatus(id, true);

            // 回调函数
            this._showByPidCallback(idArr);
        }

        // 根据 data-index 隐藏一行
        hideByDataIndex(layId, index) {
            const elem = this.getElemTrByIndex(layId, index);
            elem.addClass('layui-hide');
        }

        // 根据 data-index 显示一行
        showByDataIndex(layId, index) {
            const elem = this.getElemTrByIndex(layId, index);
            elem.removeClass('layui-hide');
        }

        // 根据 id 获取 索引
        getIndexById(data, id) {
            const keyId = this.getKeyId();
            for(let i=0; i<data.length; i++) {
                if(data[i][keyId] === id) {
                    return i + 1;
                }
            }
            return 0;
        }

        // ================== 获取器 ====================
        // 获取主键 key
        getKeyId() {
            return this.config.keyId;
        }

        // 获取上级 key
        getKeyPid() {
            return this.config.keyPid;
        }

        // 获取要缩进的字段
        getTitle() {
            return this.config.title;
        }

        // 获取缩进字符
        getIndent() {
            return this.config.indent;
        }

        // 获取图标开启
        getIconOpen() {
            return this.config.icon.open;
        }

        // 获取图标关闭
        getIconClose() {
            return this.config.icon.close;
        }

        // 获取层级
        getLevel(id) {
            if(!!id) {
                return this.run.level[id];
            }
            return this.run.level;
        }

        // 获取父子级关系
        getParentChild(id) {
            if(!!id) {
                return this.run.parentChild[id];
            }
            return this.run.parentChild;
        }

        // 获取 dataIndex
        getDataIndex() {
            return this.run.dataIndex;
        }

        // 获取是否有子级数组
        getHasChild() {
            return this.run.hasChild;
        }

        // 获取展开的id
        getUnfoldStatus(id) {
            if(!!id) {
                return this.run.unfoldStatus[id] || false;
            }
            return this.run.unfoldStatus;
        }

        // 设置展开id数据的值
        setUnfoldStatus(id, flag) {
            flag = flag || false;
            this.run.unfoldStatus[id] = flag;

            const cache = this.getShowCache();
            if(cache) {
                this.cache(cache, this.run.unfoldStatus);
            }
        }

        // 获取是否启用展示缓存,返回值是 缓存的 key
        getShowCache() {
            let cache = this.config.showCache;
            if(cache === true) {
                return "unfoldStatus";
            }
            return cache;
        }

        // 获取排序方式
        getSort() {
            return this.config.sort || 'asc';
        }

        // 缓存操作
        cache(key, val) {
            if(val) {
                val = JSON.stringify(val);
                localStorage.setItem(key, val);
            }
            return JSON.parse(localStorage.getItem(key));
        }

        // ================= 私有方法 ===================

        _initDo() {
            // 初始化运行时配置参数
            this.run = JSON.parse(JSON.stringify(this.runTemplate));

            const cache = this.getShowCache();
            if(cache) {
                this.run.unfoldStatus = this.cache(cache) || {};
            }
        }

        // 数据整理(总) - 获取数据之后,渲染数据之前.
        _parse(data) {
            // 按 pid 排序
            const keyPid = this.getKeyPid();
            data.sort((x, y) => {
                return x[keyPid] - y[keyPid];
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
        }

        // 计算最小pid.因为某些情况下.最小pid不一定是0
        _minPid(data) {
            this.run.minPid = data[0][this.getKeyPid()] || 0;
        }

        // 数据渲染之后,执行的操作
        _done(obj, res, curr, count) {
            // 初始化展开状态, 根据缓存确定是否展开,缓存没有则隐藏子级
            this._initShow(res.data, obj.id);

            // 给标题绑定点击事件
            this._bindTitleClick(res.data, obj);
        }

        // 初始化展开状态, 根据缓存确定是否展开
        _initShow(data, layId) {
            const that = this;

            const keyId = this.getKeyId();
            data.forEach((item) => {
                const id = item[keyId];

                // 判断当前折叠还是展开
                const unfoldId = that.getUnfoldStatus(id);
                if(unfoldId) {
                    // 下级展开
                    that.showByPid(id, layId);
                } else {
                    // 下级折叠
                    that.hideByPid(id, layId);
                }
            });

        }

        // 给标题绑定点击事件
        _bindTitleClick(data, obj) {
            const that = this;

            const dataIndex = this.getDataIndex();
            const keyId = this.getKeyId();
            const layId = obj.id;
            data.forEach((item) => {
                const id = item[keyId];
                const index = dataIndex[id];
                const elem = this.getElemTdByIndex(layId, index);

                const param = {
                    id: id
                    ,index: index
                }

                // 先取消后绑定.以防止重复绑定
                elem.off('click').bind('click', param, function(param) {
                    const id = param.data.id;

                    // 判断当前折叠还是展开
                    const unfoldId = that.getUnfoldStatus(id);
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
        _disposalDataIndex(data) {
            let dataIndex = {};
            const keyId = this.getKeyId();
            data.forEach((item, index) => {
                const id = item[keyId];
                dataIndex[id] = index;
            })
            this.run.dataIndex = dataIndex;
        }

        // 整理数据 - 整理父子级关系 [pid => [id, id]]
        _disposalParentChild(data) {
            const parentChild = {}
            const keyId = this.getKeyId();
            const keyPid = this.getKeyPid();

            data.forEach((item) => {
                const id = item[keyId];
                const pid = item[keyPid];
                if(pid !== this.run.minPid) {
                    const parent = parentChild[pid] || [];
                    parent.push(id);
                    parentChild[pid] = parent;
                }
            });
            this.run.parentChild = parentChild;
        }

        // 排序 - 使子级紧挨在父级下面
        _disposalSortParent(data) {
            const resData = [];

            const level = this.getLevel();
            const pc = this.getParentChild();
            const sort = this.getSort();

            const dataTop = [];
            for(let key in level) {
                if(level[key] === 0) {
                    if(sort === 'asc') {
                        dataTop.push(key);
                    } else {
                        dataTop.splice(0, 0, key);
                    }
                }
            }

            let dataTopHas = dataTop.length > 0;
            while (dataTopHas) {
                const id = parseInt(dataTop[0]);


                const i = this._getdataOriIndexById(id, data);
                if(i === undefined) {
                    dataTop.splice(0, 1);
                    dataTopHas = dataTop.length > 0;
                    continue;
                }

                // 先将值取出来存入 resData 中
                resData.push(data[i]);

                // 再从 data 中删除这个元素. 注意要用完再删
                data.splice(i, 1);

                dataTop.splice(0, 1);

                const child = pc[id];
                if(child) {
                    if(sort !== 'asc') {
                        child.sort((x, y) => {
                            return y - x;
                        });
                    }
                    dataTop.splice(0, 0, ...child);
                }

                dataTopHas = dataTop.length > 0;
            }

            return resData;
        }

        // 获取某id=x所在某个数组的位置
        _getdataOriIndexById(id, data) {
            const keyId = this.getKeyId();
            for(let i=0; i<data.length; i++) {
                const line = data[i];
                if(line[keyId] === id) {
                    return i;
                }
            }
            return false;
        }

        // 显示缩进 - 标题前面增加缩进字符串
        _showIndent(data) {
            let tmp = [];

            const indent = this.getIndent();
            const level = this.getLevel();
            const keyId = this.getKeyId();

            data.forEach((item) => {
                const id = item[keyId];
                const title = this.getTitle();
                for(let i=0; i<level[id]; i++) {
                    item[title] = indent + item[title];
                }
                tmp.push(item);
            })
            return tmp;
        }

        // 整理数据 - 层级[id=>level]
        _disposalLevel(data) {
            let level = {}; // id => level

            const keyId = this.getKeyId();
            const keyPid = this.getKeyPid();

            data.forEach((item) => {
                const id = item[keyId];
                const pid = item[keyPid];
                if(pid === this.run.minPid) {
                    // 如果是顶级,则直接加入到 level 中
                    level[id] = 0;
                } else {
                    // 如果不是顶级, 从 level 中取上级的level, 加1 存入 level 中
                    const levelItem = level[pid];
                    if(typeof(levelItem) == "undefined") {
                        level[id] = 0
                    } else {
                        level[id] = levelItem + 1;
                    }
                }
            });
            this.run.level = level;
        }

        // 显示图标 - 标题增加span标签
        _showIcon(data) {
            let tmp = [];

            const keyId = this.getKeyId();
            const hasChild = this.getHasChild();

            data.forEach((item) => {
                const id = item[keyId];
                const title = this.getTitle();
                const iconClose = this.getIconClose();
                if(hasChild[id]) {
                    item[title] = '<span class="'+ iconClose +'"></span>' + item[title];
                }
                tmp.push(item);
            });
            return tmp;
        }

        // 整理数据 - 某数据是否有子级
        _disposalHasChild(data) {
            let hasChild = {};

            const keyId = this.getKeyId();
            const keyPid = this.getKeyPid();

            data.forEach((item) => {
                const id = item[keyId];
                const pid = item[keyPid];
                //hasChild[id] = false; // 在顺序混乱的情况下.会出现id=false覆盖pid=true的情况.id=pid的情况下.
                hasChild[pid] = true;
            });
            this.run.hasChild = hasChild;
        }

        // 展开回调函数
        _showByPidCallback(idArr) {
            let callback = this.config.showByPidCallback
            if(JSON.stringify(callback) !== "{}") {
                callback(idArr);
            }
        }

        // 折叠回调函数
        _hideByPidCallback(idArr) {
            let callback = this.config.hideByPidCallback
            if(JSON.stringify(callback) !== "{}") {
                callback(idArr);
            }
        }

    }

    const obj = new Tree();
    exports(MOD_NAME, obj)
});