layui.define(['table', 'jquery'], function(exports) {
    const MOD_NAME = 'tableTree';
    const $ = layui.jquery;
    const table = layui.table;

    class Tree {
        config = {
            keyId: "id" // 当前ID
            , keyPid: "pid" // 上级ID
            , title: "name" // 标题名称字段,此字段td用于绑定单击折叠展开功能
            , indent: ' &nbsp; &nbsp;' // 缩进.可以是其他字符
            // 图标
            , icon: {
                open: 'layui-icon layui-icon-triangle-d', // 展开时候图标
                close: 'layui-icon layui-icon-triangle-r', // 折叠时候图标
            }
        };
        // 运行数据模板
        runTemplate = {
            hasChild: {} // 是否有子级[id=>true]
            , level: {} // 层级 [id=>0]
            , parentCHild: {} // 父子级关系 [pid=> [id, id]]
            , dataIndex: {} // 表格 data-index 与 数据id 的对应关系
            , unfoldStatus: {} // id=>true ,true展开, false折叠.
        }
        // 实际运行时候的数据
        run = {}

        // 渲染
        render = (obj, config) => {
            // 初始化运行时配置参数
            this.run = JSON.parse(JSON.stringify(this.runTemplate));

            if(!!config) {
                this.config = $.extend(this.config, config);
            }

            // 整理数据初始状态
            obj.parseData = (res) => {
                res.data = this.parse(res.data);
                return res;
            }

            // 数据渲染完成后,执行隐藏操作
            const done = obj.done || {};
            obj.done = (res, curr, count) => {
                this.done(obj, res, curr, count);
                if(JSON.stringify(done) !== "{}") {
                    done(res, curr, count);
                }
            }

            table.render(obj);
        }

        // 数据整理(总) - 获取数据之后,渲染数据之前.
        parse = (data) => {
            // 按 pid 排序
            data.sort((x, y) => {
                return x.pid - y.pid;
            });

            // 计算子级
            this.disposalHasChild(data);

            // 显示图标 -- 给标题增加图标span
            data = this.showIcon(data);

            // 计算层级
            this.disposalLevel(data);

            // 缩进显示
            data = this.showIndent(data);

            // 排序, 使子级紧挨在父级下面
            data = this.disposalSortParent(data);

            // 整理父子级关系,只有两级,毕竟点击上级只展开下级.下级的下级并没有展开的需求
            this.disposalParentChild(data);

            // 整理 data-index 与 id 的对应关系,点击得到 data-index => $(data-index) => id; id => dataIndex[id] => data-index
            this.disposalDataIndex(data);



            return data;
        }

        // 数据渲染之后,执行的操作
        done = (obj, res, curr, count) => {
            // 初始状态,隐藏子级
            this.hideAll(obj);

            // 给标题绑定点击事件
            this.bindTitleClick(res.data, obj);
        }

        // 给标题绑定点击事件
        bindTitleClick = (data, obj) => {
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
                elem.bind('click', param, function(param) {
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

        // 隐藏全部子级
        hideAll = (obj) => {
            const parentChild = this.getParentChild();
            const dataIndex = this.getDataIndex();

            for(let key in parentChild) {
                const child = parentChild[key];
                const layId = obj.id;

                child.forEach((id) => {
                    const index = dataIndex[id];
                    this.hideByDataIndex(layId, index);
                });
            }
        }

        // 显示全部子级
        showAll = (obj) => {
            const parentChild = this.getParentChild();
            const dataIndex = this.getDataIndex();

            for(let key in parentChild) {
                const child = parentChild[key];
                const layId = obj.id;

                child.forEach((id) => {
                    const index = dataIndex[id];
                    this.showByDataIndex(layId, index);
                });
            }
        }

        getElemTrByIndex = (layId, index) => {
            return $("[lay-id='"+ layId +"'] table tr[data-index='"+ index +"']");
        }

        getElemTdByIndex = (layId, index) => {
            const title = this.getTitle();
            return $("[lay-id='"+ layId +"'] table tr[data-index='"+ index +"'] td[data-field="+ title +"]");
        }

        getElemIconByIndex = (layId, index) => {
            const title = this.getTitle();
            return $("[lay-id='"+ layId +"'] table tr[data-index='"+ index +"'] td[data-field="+ title +"] div span");
        }

        // 根据父元素隐藏子元素
        hideByPid = (id, layId) => {
            const idArr = this.getParentChild(id);
            if(!idArr) {
                return false;
            }

            const dataIndex = this.getDataIndex();

            // 当前展开状态, 执行隐藏操作
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
        }

        showByPid = (id, layId) => {
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
        }

        // 根据 data-index 隐藏一行
        hideByDataIndex = (layId, index) => {
            const elem = this.getElemTrByIndex(layId, index);
            elem.addClass('layui-hide');
        }

        // 根据 data-index 显示一行
        showByDataIndex = (layId, index) => {
            const elem = this.getElemTrByIndex(layId, index);
            elem.removeClass('layui-hide');
        }

        // 整理数据 - 整理 layui.table 行中的 data-index 与 数据id 的对应关系[id=>index]
        disposalDataIndex = (data) => {
            let dataIndex = {};
            const keyId = this.getKeyId();
            data.forEach((item, index) => {
                const id = item[keyId];
                dataIndex[id] = index;
            })
            this.run.dataIndex = dataIndex;
        }

        // 整理数据 - 整理父子级关系 [pid => [id, id]]
        disposalParentChild = (data) => {
            const parentChild = {}
            const keyId = this.getKeyId();
            const keyPid = this.getKeyPid();

            data.forEach((item) => {
                const id = item[keyId];
                const pid = item[keyPid];
                if(pid !== 0) {
                    const parent = parentChild[pid] || [];
                    parent.push(id);
                    parentChild[pid] = parent;
                }
            });
            this.run.parentCHild = parentChild;
        }

        // 排序 - 使子级紧挨在父级下面
        disposalSortParent = (data) => {
            let tmp = [];

            const keyPid = this.getKeyPid();

            data.forEach((item) => {
                const pid = item[keyPid];
                const index = this.getIndexById(tmp, pid);
                tmp.splice(index, 0, item);
            })
            return tmp;
        }

        // 显示缩进 - 标题前面增加缩进字符串
        showIndent = (data) => {
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
        disposalLevel = (data) => {
            let level = {}; // id => level

            const keyId = this.getKeyId();
            const keyPid = this.getKeyPid();

            data.forEach((item) => {
                const id = item[keyId];
                const pid = item[keyPid];
                if(pid === 0) {
                    // 如果是顶级,则直接加入到 level 中
                    level[id] = 0;
                } else {
                    // 如果不是顶级, 从 level 中取上级的level, 加1 存入 level 中
                    const levelItem = level[pid];
                    level[id] = levelItem + 1;
                }
            });
            this.run.level = level;
        }

        // 显示图标 - 标题增加span标签
        showIcon = (data) => {
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
        disposalHasChild = (data) => {
            let hasChild = {};

            const keyId = this.getKeyId();
            const keyPid = this.getKeyPid();

            data.forEach((item) => {
                const id = item[keyId];
                const pid = item[keyPid];
                hasChild[id] = false;
                hasChild[pid] = true;
            });
            this.run.hasChild = hasChild;
        }

        // 根据 id 获取 索引
        getIndexById = (data, id) => {
            const keyId = this.getKeyId();
            for(let i=0; i<data.length; i++) {
                if(data[i][keyId] === id) {
                    return i + 1;
                }
            }
            return 0;
        }

        getHasChild = () => {
            return this.run.hasChild;
        }


        // ================== 获取器 ====================
        // 获取主键 key
        getKeyId = () => {
            return this.config.keyId;
        }

        // 获取上级 key
        getKeyPid = () => {
            return this.config.keyPid;
        }

        // 获取要缩进的字段
        getTitle = () => {
            return this.config.title;
        }

        // 获取缩进字符
        getIndent = () => {
            return this.config.indent;
        }

        // 获取图标开启
        getIconOpen = () => {
            return this.config.icon.open;
        }

        // 获取图标关闭
        getIconClose = () => {
            return this.config.icon.close;
        }

        // 获取层级
        getLevel = (id) => {
            if(!!id) {
                return this.run.level[id];
            }
            return this.run.level;
        }

        // 获取父子级关系
        getParentChild = (id) => {
            if(!!id) {
                return this.run.parentCHild[id];
            }
            return this.run.parentCHild;
        }

        // 获取 dataIndex
        getDataIndex = () => {
            return this.run.dataIndex;
        }

        // 获取展开的id
        getUnfoldStatus = (id) => {
            if(!!id) {
                return this.run.unfoldStatus[id] || false;
            }
            return this.run.unfoldStatus;
        }

        // 设置展开id数据的值
        setUnfoldStatus = (id, flag) => {
            flag = flag || false;
            this.run.unfoldStatus[id] = flag;
        }
    }

    const obj = new Tree();
    exports(MOD_NAME, obj)
});