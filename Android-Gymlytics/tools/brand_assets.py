"""Build Gymlytics launcher icons before Android compilation/signing."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math,sys
ROOT=Path(__file__).resolve().parents[1]
DARK=(5,13,31,255)
def logo():
    image=Image.new("RGBA",(1024,1024),DARK)
    for r,a in ((390,38),(300,34)):
        haze=Image.new("RGBA",(1024,1024));d=ImageDraw.Draw(haze)
        d.ellipse((512-r,512-r,512+r,512+r),fill=(12,169,240,a))
        image=Image.alpha_composite(image,haze.filter(ImageFilter.GaussianBlur(85)))
    d=ImageDraw.Draw(image)
    hexagon=[(512+320*math.cos(math.radians(60*i-30)),512+320*math.sin(math.radians(60*i-30))) for i in range(6)]
    d.line(hexagon+[hexagon[0]],fill=(115,94,251,255),width=16,joint="curve")
    try: font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",225)
    except OSError: font=ImageFont.load_default()
    bbox=d.textbbox((0,0),"GY",font=font)
    d.text(((1024-(bbox[2]-bbox[0]))/2,245),"GY",font=font,fill=(248,253,255,255),stroke_width=2)
    cyan=(74,230,255,255);violet=(180,86,255,255)
    d.rounded_rectangle((315,574,710,608),radius=16,fill=cyan)
    for l,r in ((254,292),(204,239),(736,773),(789,824)):
        d.rounded_rectangle((l,535,r,648),radius=12,fill=DARK,outline=violet if l>512 else cyan,width=11)
    try: label=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",56)
    except OSError: label=ImageFont.load_default()
    bbox=d.textbbox((0,0),"Gymlytics",font=label)
    d.text(((1024-(bbox[2]-bbox[0]))/2,696),"Gymlytics",font=label,fill=(167,228,246,255))
    return image
def main():
    image=logo();web=ROOT/"web"
    for n in (192,512):
        p=web/"icons"/f"icon-{n}.png";p.parent.mkdir(parents=True,exist_ok=True)
        image.resize((n,n),Image.Resampling.LANCZOS).save(p)
    p=web/"assets"/"gymlytics-logo.png";p.parent.mkdir(parents=True,exist_ok=True)
    image.resize((256,256),Image.Resampling.LANCZOS).save(p)
    if "--android" not in sys.argv:
        print("Web logos generated");return
    res=ROOT/"android/app/src/main/res"
    if not res.exists(): raise RuntimeError("Run npx cap add android first")
    for density,n in {"mdpi":48,"hdpi":72,"xhdpi":96,"xxhdpi":144,"xxxhdpi":192}.items():
        folder=res/f"mipmap-{density}";folder.mkdir(parents=True,exist_ok=True)
        for name in ("ic_launcher.png","ic_launcher_round.png"):
            image.resize((n,n),Image.Resampling.LANCZOS).save(folder/name)
        foreground=int(n*2.25)
        image.resize((foreground,foreground),Image.Resampling.LANCZOS).save(folder/"ic_launcher_foreground.png")
    xml='''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
<background android:drawable="@color/gymlytics_icon_bg"/>
<foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>'''
    folder=res/"mipmap-anydpi-v26";folder.mkdir(parents=True,exist_ok=True)
    for name in ("ic_launcher.xml","ic_launcher_round.xml"):
        (folder/name).write_text(xml,encoding="utf-8")
    folder=res/"values";folder.mkdir(parents=True,exist_ok=True)
    (folder/"gymlytics_colors.xml").write_text('<resources><color name="gymlytics_icon_bg">#050D1F</color></resources>',encoding="utf-8")
    for p in res.glob("drawable*/splash.png"):
        try: w,h=Image.open(p).size
        except OSError: continue
        splash=Image.new("RGBA",(w,h),DARK);n=int(min(w,h)*0.42)
        splash.alpha_composite(image.resize((n,n),Image.Resampling.LANCZOS),((w-n)//2,(h-n)//2))
        splash.save(p)
    print("Native Android launcher and splash ready")
if __name__=="__main__": main()
