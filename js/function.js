var baseServer = 'http://monitor.xiao3.org/';
var userInfo   = getUser();

$.ajaxSetup({'beforeSend': function(xhr) {xhr.setRequestHeader("Accept-Language", "en-US")}});

//LoopCheck();

function Initialize()
{
    userInfo   = getUser();
    if(!userInfo) {return;}
    LoopCheck();

    chrome.tabs.getSelected(null,function(tab)
    {
        var host = parseUri(tab.url.replace('view-source:',''));
        if(host.protocol == 'http' || host.protocol == 'https')
        {
            var link = host.protocol + '://' + host.domain + '/';
            var mySiteList = getCache('mySiteList');
            //console.log(mySiteList);
            var hasCache = false;
            if(mySiteList)
            {
                for (var i in mySiteList )
                {
                    var temp = mySiteList[i];
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

function LoopCheck()
{
    userInfo   = getUser();
    // 报告中转服务器当前情况
    get('getReport',null,function(rest)
    {
        setCache('alert',rest.items);
        setCache('myTask',rest.task);

        var alert_number = rest.items.length;
        if(alert_number)
        {
            chrome.browserAction.setIcon({path:'img/icon_alert.png'});
            chrome.browserAction.setBadgeText({text:alert_number.toString()});
        }else
        {
            chrome.browserAction.setIcon({path:'img/icon_green.png'});
            chrome.browserAction.setBadgeText({text:''});
        }
    });

    // 取得我已经监控的条目，默认缓存一天
    var mySiteList = getCache('mySiteList');
    if(!mySiteList)
    {
        get('getMySiteList',null,function(rest)
        {
            setCache('mySiteList',rest);
        });
    }
    
    // 判断是否需要进行监控
    var isDoneTask = getCache('isDoneTask');
    if(!isDoneTask)
    {
        setCache('isDoneTask',{test:0,time:0});
    }else
    {
        var date  = new Date();
        var curr_test_time  = date.getTime();
        var last_test_time  = isDoneTask.time;
        var myTask = getCache('myTask');
        var tobe_test_count = myTask ? myTask.less : 30;
        //console.log(tobe_test_count);
        // 如果已完成的监控数量小于当天所需检测的条目数量，并且距离上次监控时间大于30分钟
        if(isDoneTask.test < tobe_test_count && (curr_test_time - last_test_time) > 30 * 60 * 1000)
        {
            get('getMyTestList',null,function(rest)
            {
                setCache('myTestList',rest);
                if(rest != 0)
                {
                    setReport(rest);
                    // 取得监控的条目，30秒监控一个，直到完成。
                    setInterval(function()
                    {
                        var myTestList = getCache('myTestList');
                        setReport(myTestList);
                    },30 * 1000);
                }
            });
        }
    }

}

function setReport(data,callback)
{
    //console.log(data);
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
                var isDoneTask = getCache('isDoneTask');
                setCache('isDoneTask',{test:isDoneTask.test + 1,time:date.getTime()});
                //console.log(rest);
            });
        });
        setCache('myTestList',data);
    }
}

function markLogIsread(uuid,_this)
{
    $(_this).html('正在进行...');
    set('markLogIsread',{logs_uuid:uuid},function(rest)
    {
         $(_this).html('仍在进行...');
        get('getMySiteList',null,function(rest)
        {
            setCache('mySiteList',rest);
            $(_this).html('操作成功！').slideUp();
        });
    });
}

function set(action,args,callback)
{
    $.post(baseServer,{action:action,token:userInfo.token,send:args},function(rest)
    {
        callback.call(null,rest);
    });
}

function get(action,args,callback)
{
    $.get(baseServer,{action:action,token:userInfo.token,send:args},function(rest)
    {
        callback.call(null,rest);
    },'JSON');
}

function getToken()
{
    var passwd = _pass($('#userpass').val());
    $.post(baseServer,{action:'getToken',user:$('#username').val(),pass:passwd},function(rest)
    {
        setCache('userInfo',rest);
        Initialize();
    },'JSON');
}

function getUser()
{
    var userInfo = getCache('userInfo',86400000);
    if(userInfo)
    {
        return userInfo;
    }
    return false;
}

function _pass(str)
{
    return hex_sha1(hex_md5(str));
}


function Insert()
{
    var link = $('#this_host').text();
    $('#this_host').html('正在添加....')
    $.post(baseServer,{action:'addLink',token:userInfo.token,link:link}).complete(function(rest)
    {
        $('#this_host').html('继续工作....')
        get('getMySiteList',null,function(rest)
        {
            $('#this_host').html('添加成功！')
            setCache('mySiteList',rest);
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

