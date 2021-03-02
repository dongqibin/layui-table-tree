# layui-tableTreeDj

#### 介绍
使表格增加了树形结构展示的能力.完全依赖于layui的表格.
正因为如此,您可以像使用表格组件一样使用该组件.layui的表格功能全都有.全都有.全都有.

#### 组件引入方法请阅读 官方文档
https://www.layui.com/doc/base/modules.html#extend

```javascript

layui.use(['tableTreeDj'], function() {
        const tableTree = layui.tableTreeDj;
        const $ = layui.$;

        // 与 layui.table 的参数完全一致,内部本来就是把这些参数传递给table模块的
        const objTable = {
            elem: '#test'
            ,url: "./getData"
            ,cols: [[
                {field:'name', title:'名称' },
                {field:'id', title:'ID' },
                {field:'pid', title:'上级ID' },
                {field:'level', title:'层级' },
                {field:'agent_id', title:'代理ID' },
            ]]
            ,id:'list'
        }

        // 本组件用到的参数, 组件内部有默认值,与此一致,因此您可以只声明不一致的配置项
        const config = {
            keyId: "id" // 当前ID
            , keyPid: "pid" // 上级ID
            , title: "name" // 标题名称字段,此字段td用于绑定单击折叠展开功能
            , indent: ' &nbsp; &nbsp;' // 子级td的缩进.可以是其他字符
            // 图标
            , icon: {
                open: 'layui-icon layui-icon-triangle-d', // 展开时候图标
                close: 'layui-icon layui-icon-triangle-r', // 折叠时候图标
            }
        };
        // 渲染 
        tableTree.render(objTable, config);
    });
```
