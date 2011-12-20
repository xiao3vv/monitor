//TODO 规范命名，现在变量名称太糟糕了。。。

var baseServer = 'http://monitor.xiao3.org/';
var UserInfo   = getUser();

$.ajaxSetup({'beforeSend': function(xhr) {xhr.setRequestHeader("Accept-Language", "en-US")}});

function Initialize()
{
    UserInfo   = getUser();
    if(!UserInfo) {return;}
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

    $('#popupBox').html('<h2 id="this_addr">'+UserInfo.user_mail+'</h2>');
}

function Loop()
{
    /*
    var debug_time = new Date();
    console.log('');
    console.log( '当前时间：' + date_str());
    */

    UserInfo  = getUser();

    var UserConf = getCache('UserConf') || {sync_freq:600,task_freq:30};
    var LastSync = getCache('LastSync') || {item:0,time:0};

    var curr_sync_time = time_str();
    var last_sync_item = LastSync.item;
    var last_sync_time = LastSync.time;
    var next_sync_time = curr_sync_time - last_sync_time;
    var user_sync_freq = UserConf.sync_freq;

    if(next_sync_time > user_sync_freq * 1000)
    {
        //console.log( '同步....');
        var TestResult  = getCache('TestResult') || 0;
        $.post(baseServer,{action:'Sync',token:UserInfo.token,args:TestResult},function(rest)
        {
            setCache('ErroList',rest.erro_list);// 网站异常提醒
            setCache('TaskList',rest.task_list);// 检测任务列表
            setCache('UserConf',rest.user_conf);// 用户设置
            setCache('TestResult',[]);

            var erro_list = rest.erro_list;
            if(erro_list)
            {
                chrome.browserAction.setIcon({path:'img/icon_alert.png'});
                chrome.browserAction.setBadgeText({text:erro_list.toString()});
            }else
            {
                chrome.browserAction.setIcon({path:'img/icon_green.png'});
                chrome.browserAction.setBadgeText({text:''});
            }

        },'JSON').always(function(){
            setCache('LastSync',{item:last_sync_item + 1,time:time_str()});
        });

    }else
    {
        /*
        debug_time.setTime(last_sync_time + (user_sync_freq * 1000));
        console.log( '下次同步：' + date_str(debug_time));
        */
    }

    // 取得我已经监控的条目，默认缓存一天
    var SiteList = getCache('SiteList');
    if(!SiteList && UserInfo)
    {
        get('SiteList',null,function(rest)
        {
            setCache('SiteList',rest);
        });
    }

    Monitor(UserConf);
}

// 
function Monitor(UserConf)
{
    var time_start = time_str();
    var task_data = getCache('TaskList');
    var last_time = getCacheTime('TaskList');
    var task_freq = UserConf.task_freq * 1000;
    //console.log(time_start - last_time);
    if(task_data.length && (time_start - last_time) > task_freq)
    {
        //console.log( '开始检测');
        var item = task_data.shift();
        $.get(item.item_link).always(function(rest)
        {
            var time_close = time_str();
            var time = (time_close - time_start);
            
            // 保存检测结果
            var TestResult  = getCache('TestResult') || [];
            TestResult.push({uuid:item.item_uuid,code:rest.status,time:time});
            setCache('TestResult',TestResult);
            
            setCache('TaskList',task_data);

            //console.log( '检测 ' +item.item_uuid+ ' 完毕！');

        });
    }else
    {
        /*
        if(task_data.length)
        {
            var debug_time = new Date();
            debug_time.setTime(last_time + task_freq);
            console.log( '下次检测：' + date_str(debug_time));
        }else
        {
            console.log( '无需检测');
        }
        */
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
    $.post(baseServer,{action:action,token:UserInfo.token,args:args},function(rest)
    {
        callback.call(null,rest);
    });
}

// get方法
function get(action,args,callback)
{
    $.get(baseServer,{action:action,token:UserInfo.token,args:args},function(rest)
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
    
    $.post(baseServer,{action:'addLink',token:UserInfo.token,link:link}).complete(function(rest)
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

function getCacheTime(cache_id)
{
    if(localStorage[cache_id])
    {
        var temp = JSON.parse(localStorage[cache_id]);
        return temp.time;
    }

    return 0;
}

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
            return data ? data:false;
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

function date_str(time_str)
{
    var date = new Date;
    if(typeof time_str != 'undefined')
    {
        date.setTime(time_str);
    }
    return date.getFullYear() + '-' + time_pad(date.getMonth()) + '-' + time_pad(date.getDate()) + ' ' + time_pad(date.getHours()) + ':' + time_pad(date.getMinutes())+ ':' + time_pad(date.getSeconds());
}

function time_str()
{
    var date = new Date;
    return date.getTime();
}

function time_pad(i)
{
    if (i<10) {i="0" + i}
    return i
}