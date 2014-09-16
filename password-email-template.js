var Handlebars = require('handlebars');

var source = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">' +
             '<html xmlns="http://www.w3.org/1999/xhtml">' +
             '<head>' +
             '<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />' +
             '<title>New Telegram Password</title>' +
             '<style type="text/css">' +
             '@media only screen and (min-device-width: 601px) {' +
             '.content {' +
             'width: 600px !important;' +
             '}' +
             '.col255 {' +
             'width: 255px !important;' +
             '}' +
             '.col255:last-child {' +
             'text-align: right;' +
             '}' +
             '}' +
             '</style>' +
             '</head>' +
             '<body style="margin: 0; padding: 0; min-width: 100% !important;">' +
             '<table width="100%" border="0" cellpadding="0" cellspacing="0">' +
             '<tr>' +
             '<td>' +
             '<!--[if (gte mso 9)|(IE)]>' +
             '<table width="600" align="center" cellpadding="0" cellspacing="0" border="0">' +
             '<tr>' +
             '<td>' +
             '<![endif]-->' +
             '<table class="content" width="100%" align="center" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">' +
             '<tr>' +
             '<td class="header" style="padding: 40px 30px 20px 30px; border-bottom: 5px solid #008cb8;">' +
             '<table class="col255" width="255" align="left" border="0" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 255px;">' +
             '<tr>' +
             '<td height="80" style="font-family: sans-serif; font-size: 56px; color: #00b1f0;">' +
             '<img src="http://i.imgur.com/G9WYK2M.png" width="234" height="77" border="0" alt="telegram" />' +
             '</td>' +
             '</tr>' +
             '</table>' +
             '<table class="col255" width="255" align="right" border="0" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 255px;">' +
             '<tr>' +
             '<td height="80" style="font-family: sans-serif; font-size: 16px; color: #999999;">' +
             '<img src="http://i.imgur.com/coZPB8I.png" width="193" height="66" border="0" alt="postmark" />' +
             '</td>' +
             '</tr>' +
             '</table>' +
             '</td>' +
             '</tr>' +
             '<tr>' +
             '<td>' +
             '<table cellpadding="0" cellspacing="0" width="100%" style="font-family: sans-serif; font-size: 16px; line-height: 1.5; color: #444444;">' +
             '<tr>' +
             '<td style="padding: 30px 30px 8px 30px;">' +
             'Hey there,<br />' +
             'Your new password is {{password}}.' +
             '</td>' +
             '</tr>' +
             '<tr>' +
             '<td style="padding: 8px 30px 30px 30px;">' +
             'All the best,<br />' +
             'The Telegram App Team' +
             '</td>' +
             '</tr>' +
             '</table>' +
             '</td>' +
             '</tr>' +
             '<tr>' +
             '<td bgcolor="#008cb8" style="padding: 30px 30px 30px 30px; font-family: sans-serif; font-size: 16px; color: #ffffff;">' +
             '&copy; Telegram 2014.' +
             '</td>' +
             '</tr>' +
             '</table>' +
             '<!--[if (gte mso 9)|(IE)]>' +
             '</td>' +
             '</tr>' +
             '</table>' +
             '<![endif]-->' +
             '</td>' +
             '</tr>' +
             '</table>' +
             '</body>' +
             '</html>';

var template = Handlebars.compile(source);

module.exports = template;