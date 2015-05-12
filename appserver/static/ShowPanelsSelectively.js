
var questionlist = "<h2>Questions To Ask</h2>\
        <ul>\
                <li><a href=\"javascript:SetToken('Visibility_CountByUser');\">I want to understand changes over time... how many searches are run per user, per day?</a></li>\
                <li><a href=\"javascript:SetToken('Visibility_ActivityBySearchType');\">I want to understand changes over time... how many searches by type, per day?</a></li>\
                <li><a href=\"javascript:SetToken('Visibility_ActivityBySearchHead');\">What is my activity per search head?</a></li>\
                <li><a href=\"javascript:SetToken('Visibility_ExportedSearch');\">Are my users exporting search results?</a></li>\
                <li><a href=\"javascript:SetToken('Visibility_SharedSearches');\">Are my users sharing search results?</a></li>\
                <li><a href=\"javascript:SetToken('Visibility_ExpensiveCommands');\">What search commands are associated with slow searches?</a></li>\
                <li><a href=\"javascript:SetToken('Visibility_SearchTimespan');\">Over what timespan are users searching?</a></li>\
                <li><a href=\"javascript:SetToken('Visibility_UserPerformance');\">Are the users search behavior changing over time (with regard to performance metrics)?</a></li>\
                <li><a href=\"javascript:SetToken('Visibility_SystemPerformance');\">Is the system's performance behavior changing over time?</a></li>\
</ul><p><a href\"javascript:SetToken('ALL');\">Show All (2.0 and prior view)</a></p>"

document.getElementById("ProvideQuestions").innerHTML = questionlist

//document.getElementById("ProvideQuestions").innerHTML = "<h2>Questions To Ask</h2><ul><li><a href=\"#\" onclick=\"SetToken('Visibility_ActivityBySearchHead');\">What is my activity per search head?</a></li></ul>"

function SetToken(tokenname){
console.log("Testing...")
    if(tokenname == "ALL"){
        SetToken('Visibility_CountByUser');
        SetToken('Visibility_ActivityBySearchType');
        SetToken('Visibility_ActivityBySearchHead');
        SetToken('Visibility_ExportedSearch');
        SetToken('Visibility_SharedSearches');
        SetToken('Visibility_ExpensiveCommands');
        SetToken('Visibility_SearchTimespan');
        SetToken('Visibility_UserPerformance');
        SetToken('Visibility_SystemPerformance');

    }else{
        require(['splunkjs/mvc','splunkjs/mvc/utils','splunkjs/mvc/simplexml/ready!'], function(mvc, utils){
                            var unsubmittedTokens = mvc.Components.getInstance('default');
                            var submittedTokens = mvc.Components.getInstance('submitted');
                            console.log("About to set token...")
                                console.log("token name", tokenname);
                             unsubmittedTokens.set(tokenname,"I have a token!");
                            submittedTokens.set(unsubmittedTokens.toJSON());
        });
   
    }

return false;
}
