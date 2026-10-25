<?php
if ($loginType == 0)
{
	$key = "bfd51210-0fd3-424b-af94-557df4877239";
	$url = "http://wif.12ha.com/webuserchecklogin/webgame_rxsg_userchecklogin_get.aspx?";
	$url .= "pusername=".$passport."&ppsw=".md5($password)."&ptype=wg&sign=".md5($passport.md5($password)."wg".$key);
	$ret = file_get_contents($url);
//	if($passport=='wolfdog003' || $passport=='ilovelate')
//	{
		file_put_contents("/var/www/html/agents/log/12ha.log",$url."||".$ret,FILE_APPEND);
//	}
	if ($ret == "1")
	{
		$passsucc=true;
	}
}
?>
