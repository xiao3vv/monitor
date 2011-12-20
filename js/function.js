//TODO 规范命名，现在变量名称太糟糕了。。。

var baseServer = 'http://monitor.xiao3.org/';
var userInfo   = getUser();

$.ajaxSetup({'beforeSend': function(xhr) {xhr.setRequestHeader("Accept-Language", "en-US")}});

function Initialize()
{
    userInfo   = getUser();
    if(!userInfo) {return;}
    Loop();

    chrome.tabs.getSelected(null,function(tab)
    {
        var host = parseUri(tab.url.replace('view-source:',''));
        if(host.protocol == 'http' || host.protocol == 'https')
        {
            var link = host.protocol + '://' + host.domain + '/';
            var SiteList = getCache('SiteList');
            var hasCache = false;
            if(SiteList)
            {
                for (var i in SiteList )
                {
                    var temp = SiteList[i];
                    //console.log(temp);
                    if(temp.item_link == link)
                    {
                        hasCache = true;
                    }
                }
            }

            if(hasCache === false)
            {
                $('#this_host').html(link).show();
            }
        }
    });

    $('#popupBox').html('<h2 id="this_addr">'+userInfo.user_mail+'</h2>');
}

function Loop()
{
    var debug_time = new Date();//last_test_time;
    console.log('');
    console.log( '当前时间：' + debug_time);

    userInfo  = getUser();
    var Tasks = getCache('Tasks');
    var LastSync = getCache('LastSync');
    var date  = new Date();
    var curr_sync_time = date.getTime();
    var last_sync_item = LastSync ? LastSync.item : 0;
    var last_sync_time = LastSync ? LastSync.time : 0;
    var next_sync_time = curr_sync_time - last_sync_time;
    var user_sync_freq = Tasks ? Tasks.sync_freq:600;
    
    if(next_sync_time > user_sync_freq * 1000)
    {
        console.log( '同步....');
        // 报告中转服务器当前情况
        $.get(baseServer,{action:'Sync',token:userInfo.token},function(rest)
        {
            setCache('Notify',rest.items);
            setCache('Tasks',rest.tasks);
            var notify_items = rest.items.length;
            if(notify_items)
            {
                chrome.browserAction.setIcon({path:'img/icon_alert.png'});
                chrome.browserAction.setBadgeText({text:notify_items.toString()});
            }else
            {
                chrome.browserAction.setIcon({path:'img/icon_green.png'});
                chrome.browserAction.setBadgeText({text:''});
            }

        },'JSON').always(function(){
            setCache('LastSync',{item:last_sync_item + 1,time:date.getTime()});        
        });

    }else
    {
        debug_time.setTime(last_sync_time + (user_sync_freq * 1000));
        console.log( '下次同步：' + debug_time);
    }

    // 取得我已经监控的条目，默认缓存一天
    var SiteList = getCache('SiteList');
    if(!SiteList && userInfo)
    {
        get('SiteList',null,function(rest)
        {
            setCache('SiteList',rest);
        });
    }
    
    // 判断是否需要进行监控
    var TestTask = getCache('TestTask');
    var date  = new Date();
    if(!TestTask)
    {
        setCache('TestTask',{item:0,time:date.getTime()});
    }
    var curr_test_time = date.getTime();
    var last_test_time = TestTask ? TestTask.time : 0;
    var last_test_item = TestTask ? TestTask.item : 0;
    var user_test_less = Tasks ? Tasks.task_less  : 30;
    var user_test_freq = Tasks ? Tasks.test_freq  : 30 * 60;
    var user_item_freq = Tasks ? Tasks.item_freq : 30;
    
    //user_test_freq = 10;
    //console.log((curr_test_time - last_test_time));

    // 如果已完成的监控数量小于当天所需检测的条目数量，并且距离上次监控时间大于30分钟
    if( last_test_item < user_test_less && (curr_test_time - last_test_time) > (user_test_freq * 1000))
    {
        console.log( '监控....');
        get('TestList',null,function(rest)
        {
            setCache('TestList',rest);
            if(rest != 0)
            {
                Monitor(rest);
                // 循环监控直到完成。
                setInterval(function()
                {
                    var TestList = getCache('TestList');
                    Monitor(TestList);
                },user_item_freq * 1000);
            }else
            {
                var TestTask = getCache('TestTask');
                setCache('TestTask',{item:TestTask.item,time:date.getTime()});
            }
        });
    }else
    {
        debug_time.setTime(last_test_time + (user_test_freq * 1000));
        console.log( '下次监控：' + debug_time);
    }
}

// 
function Monitor(data,callback)
{
    var date = new Date();
    var time_start = date.getTime();
    var item = data.shift();
    if(item)
    {
        $.get(item.item_link).complete(function(rest)
        {
            var date = new Date();
            var time_close = date.getTime();
            var time = (time_close - time_start);
            set('setReport',{uuid:item.item_uuid,code:rest.status,time:time},function(rest)
            {
                console.log( '检测 ' +item.item_uuid+ ' 完毕！');
                var TestTask = getCache('TestTask');
                setCache('TestTask',{item:TestTask.item + 1,time:date.getTime()});
                //console.log(rest);
            });
        });
        setCache('TestList',data);
    }else
    {
        var TestTask = getCache('TestTask');
        setCache('TestTask',{item:TestTask.item,time:date.getTime()});
    }
}

// 标记异常为已读
function markLogIsread(uuid,_this)
{
    $(_this).html('正在进行...');
    set('markLogIsread',{logs_uuid:uuid},function(rest)
    {
         $(_this).html('仍在进行...');
        get('SiteList',null,function(rest)
        {
            setCache('SiteList',rest);
            $(_this).html('操作成功！').delay(500).fadeOut();
        });
    });
}

// post方法
function set(action,args,callback)
{
    $.post(baseServer,{action:action,token:userInfo.token,send:args},function(rest)
    {
        callback.call(null,rest);
    });
}

// get方法
function get(action,args,callback)
{
    $.get(baseServer,{action:action,token:userInfo.token,send:args},function(rest)
    {
        callback.call(null,rest);
    },'JSON');
}

// 取得accessToken
function getToken()
{
    var passwd = _pass($('#userpass').val());
    $.post(baseServer,{action:'getToken',user:$('#username').val(),pass:passwd},function(rest)
    {
        setCache('UserInfo',rest);
        Initialize();
    },'JSON');
}

// 取得当前账户
function getUser()
{
    var userInfo = getCache('UserInfo',86400000);
    if(userInfo)
    {
        return userInfo;
    }
    return false;
}


// 添加监控站点
function Insert()
{
    var link = $('#this_host').text();
    $('#this_host').html('正在添加....');
    
    $.post(baseServer,{action:'addLink',token:userInfo.token,link:link}).complete(function(rest)
    {
        $('#this_host').html('继续工作....')
        get('SiteList',null,function(rest)
        {
            $('#this_host').html('添加成功！').delay(500).fadeOut();
            setCache('SiteList',rest);
            $('#this_host').slideUp();
        });
    });

};


function getCache(cache_id,life_time)
{
    if(localStorage[cache_id])
    {
        if(typeof life_time == 'undefined')
        {
            life_time = 86400
        }
        var date = new Date();
        var time = date.getTime();
        var temp = JSON.parse(localStorage[cache_id]);
        var test = temp.time;
        if((time - test) < (1000 * life_time))
        {
            var data = temp.data;
            return data == '[]' ? 0 :data;
        }

        return false;
    }

    return false;
}

function setCache(cache_id,data)
{
    var date = new Date();
    var temp = {data:data,time:date.getTime()}
    localStorage[cache_id] = JSON.stringify(temp);
}

function _pass(str)
{
    return hex_sha1(hex_md5(str));
}

function parseUri(sourceUri)
{
    var uriPartNames = ["source","protocol","authority","domain","port","path","directoryPath","fileName","query","anchor"],
        uriParts = new RegExp("^(?:([^:/?#.]+):)?(?://)?(([^:/?#]*)(?::(\\d*))?)((/(?:[^?#](?![^?#/]*\\.[^?#/.]+(?:[\\?#]|$)))*/?)?([^?#/]*))?(?:\\?([^#]*))?(?:#(.*))?").exec(sourceUri),
        uri = {};
    
    for(var i = 0; i < 10; i++){
        uri[uriPartNames[i]] = (uriParts[i] ? uriParts[i] : "");
    }
    
    if(uri.directoryPath.length > 0){
        uri.directoryPath = uri.directoryPath.replace(/\/?$/, "/");
    }
    
    return uri;
}

