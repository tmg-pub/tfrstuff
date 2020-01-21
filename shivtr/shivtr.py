import sys, requests, yaml, re, json

#------------------------------------------------------------------------------
def HTMLtoDiscord( html ):
   if not html or len(html) == 0: return ""
   
   # Not really worth precompiling anything in here because usually there's
   #  only going to be one new forum post to translate at a time.
   html = re.sub( r"<br>", "\n", html )
   html = re.sub( r"<li>", "\n• ", html )
   
   html = re.sub( r"<b>(\s*)", r"\1**", html )
   html = re.sub( r"(\s*)<\/b>", r"**\1", html )

   html = re.sub( r"<u>(\s*)", r"\1__", html )
   html = re.sub( r"(\s*)<\/u>", r"__\1", html )

   html = re.sub( r"<i>(\s*)", r"\1*", html )
   html = re.sub( r"(\s*)<\/i>", r"*\1", html )
   
   html = re.sub( r"<a.+?href=\"([^\"]+)\".+?>(.+)<\/a>", r"[\2](\1)", html );
   
   image = re.search( r"<img.+?src=\"([^\"]+)\"", html )
   
   html = re.sub( r"<a.+?href=\"([^\"]+)\".+?>(.+)<\/a>", r"[\2](\1)", html );
   html = re.sub( r"<img.+?>", "[image]", html );
   
   html = re.sub( r"<[^>]*>", "", html )
   
   return html, image[1] if image else None
   
#------------------------------------------------------------------------------   
def SendToDiscord( settings ):
   
   # Settings are:
   #  content - the body of the post
   #  newthread - true if this is the first post in the thread
   #  title - title of thread
   #  image - url of image to show
   #  name - the poster's name
   #  avatar - url to the poster's avatar
   #  date - date string, used directly
   #  url - url to post
   desc = settings["content"]
   if settings["newthread"]:
      title = settings["title"]
   else:
      title = "Re: " + settings["title"]
   print( settings["image"] )
   discord = {
      "content": "",
      "embeds": [{
         "title": title,
         "description": desc,
         "url": settings["url"],
         "author": {
            "name": settings["name"],
            "icon_url": settings["avatar"]
         },
         "footer": {
            "text": settings["date"]
         }
         #"thumbnail": {
         #   "url": settings["avatar"]
         #}
      }]
   }
   
   if "image" in settings and settings["image"]:
      discord["embeds"][0]["image"] = {
         "url": settings["image"]
      }
   
   for hook in config["hooks"]:
      requests.post( hook, json = discord )

#------------------------------------------------------------------------------
def Abort( reason ):
   print( "Aborting:", reason )
   sys.exit( -1 )
   
#//////////////////////////////////////////////////////////////////////////////
# Load configuration file.
with open( "shivtr.yaml", "rb" ) as fp:
   config = yaml.full_load( fp )
   
# Load the list of posts that we've already handled.
try:
   with open( "posts_handled.txt", "r" ) as fp:
      posts_handled = fp.read().splitlines()
except:
   posts_handled = []
print( "POSTS HANDLED:", posts_handled )
posts_handled_dict = { a:True for a in posts_handled }

# URLs to shivtr forums look like:
#   https://mysite.shivtr.com
base_url = "https://" + config["slug"] + ".shivtr.com"
headers = {'user-agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36'}

# Sign in to shivtr.
print( "Logging in to shivtr." )
data = requests.get( base_url + "/users/sign_in" )
# The login screen has a hidden authenticity token.
token = re.search( r"<input[^>]+name=\"authenticity_token\"[^>]+value=\"([^\"]+)", data.text )
if not token:
   abort( "Couldn't get authenticity token." )
authenticity_token = token[1]

cookies = data.cookies

data = requests.post( base_url + "/users/sign_in", params = {
   "commit"             : "Login",
   "utf8"               : "&#x2713;",
   "return_to"          : "",
   "user[email]"        : config["user_email"],
   "user[password]"     : config["user_password"],
   "user[remember_me]"  : "0",
   "authenticity_token" : authenticity_token
}, cookies = cookies)

# Use these cookies with additional requests.
cookies = data.cookies

# Fetch the activity listing. This is sorted with new posts at the top.
data = requests.get( base_url + "/activities/site", cookies=cookies )

# Regex to parse each post or new thread.
rx = re.compile( r"<div class='mar_bottom'>\s*<a class=\"member_link\" .*>([^<]*?)</a>\s*added a forum (\S+)\s*</div>\s*<h2>\s*<a href=\"([^\"]+)\">([^<]+)</a>\s*</h2>\s*<div class='mar_bottom'>\s*(.+?)</div>" )

results = rx.findall( data.text )

if not results:
   # Probably will happen if the site updates their layout.
   print( "Couldn't find results." )
   sys.exit( 0 )

content_pages = {}
print(results)

# Go through the posts, and stop when we find one that we've already posted.
# Truncate the list to there, and reverse it so we're posting from oldest to newest.
for index, result in enumerate(results):
   if result[2] in posts_handled_dict:
      results = results[:index]
      break

for result in reversed(results):
   
   # Sources are two parts, the one from the activity listing, and
   # we also make a request to the forum post url to read the full content
   # and format it ourselves.
   print( "USER:",  result[0] )
   print( "TYPE:",  result[1] )
   print( "LINK:",  result[2] )
   print( "TITLE:", result[3] )
   
   name = result[0]
   type = result[1]
   link = result[2]
   title = result[3]
   
   posts_handled.append( link )
   
   # Link is in the format
   # /forum_threads/3166383?post=14274944#forum_post_14274944
   #  for replies, OR 
   # /forum_threads/3166383
   #  for new threads.
   # In the latter form, the page searcher just matches any first post, because
   #  we don't know the ID.
   postid = re.search( r"post=(\d+)", result[2] )
   if postid:
      postid = postid[1]
   else:
      postid = r"\d+"
   
   # Fetch the page with this post.   
   link_without_hash = re.sub( "#.+", "", result[2] )
   data = requests.get( base_url + link_without_hash, cookies=cookies ).text
   
   # Parse the post contents.
   parsed = re.search( r"<div name=\"forum_post_%s\"[^>]+>.+?<th class=\"forum_posts_date.+?><a[^>]+>.+?</a>(.+?)</th>.+?member_avatar.+?background-image:\s*url\(&#39;(.+?)&#39;\).+?<div class=\"poster_name\">(.+?)</div>.+?</div>.+?<div class=\"entry\">(.+?)</div>" % postid, data )
   
   print( "DATE:",   parsed[1] )
   print( "AVATAR:", parsed[2] )
   print( "NAME:",   parsed[3] )
   
   # The date may have "Edited by xyz" attached. Cut that out - it's marked by
   #  a middle dot.
   date = re.sub( "&middot;.*", "", parsed[1] ).strip()
   avatar = parsed[2]
   print( "FIXED DATE:", date)
   
   content, image = HTMLtoDiscord( parsed[4] )
   
   if len(content) > 1500:
      content = content[:1500] + "..."
   
   SendToDiscord({
      "name"      : name,
      "url"       : base_url + link,
      "content"   : content,
      "title"     : title,
      "avatar"    : avatar,
      "newthread" : True if type == "thread" else False,
      "image"     : image,
      "date"      : date
   })
   
   print( '---' )
   
print( "POSTS HANDLED:", posts_handled )

# Keep our handled posts list to 100 entries. We really only need 1 if nobody
#  deletes anything.
posts_handled = posts_handled[-100:]
   
with open( "posts_handled.txt", "w" ) as fp:
   fp.write( "\n".join(posts_handled) )
