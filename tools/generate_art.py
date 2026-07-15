#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
import math, random

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'art'
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1600, 900
SERIF = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
SANS = '/usr/share/fonts/truetype/lato/Lato-Medium.ttf'

SCENES = [
    ('month-01-theophany.jpg', 'THEOPHANY', 'Light upon the waters', (18,50,78), (181,134,47), 'water'),
    ('month-02-temple.jpg', 'THE MEETING', 'A light for revelation', (49,33,61), (198,153,73), 'temple'),
    ('month-03-lent.jpg', 'GREAT LENT', 'Return in stillness', (48,31,35), (145,93,51), 'lent'),
    ('month-04-pascha.jpg', 'PASCHA', 'Christ is risen', (61,17,25), (224,179,79), 'pascha'),
    ('month-05-ascension.jpg', 'ASCENSION', 'Lift up your hearts', (35,67,91), (218,189,113), 'ascension'),
    ('month-06-pentecost.jpg', 'PENTECOST', 'The Spirit gives life', (28,63,47), (218,155,67), 'pentecost'),
    ('month-07-apostles.jpg', 'APOSTLES', 'Sent into all the world', (35,48,69), (191,136,55), 'apostles'),
    ('month-08-transfiguration.jpg', 'TRANSFIGURATION', 'The uncreated light', (50,72,91), (232,203,128), 'mountain'),
    ('month-09-cross.jpg', 'THE PRECIOUS CROSS', 'Before Thy Cross we bow down', (67,20,26), (203,159,66), 'cross'),
    ('month-10-protection.jpg', 'THE PROTECTION', 'Shelter under mercy', (37,57,79), (199,162,92), 'veil'),
    ('month-11-archangels.jpg', 'THE BODILESS POWERS', 'Messengers of the Most High', (28,36,63), (211,169,82), 'angels'),
    ('month-12-nativity.jpg', 'THE NATIVITY', 'Glory to God in the highest', (28,34,56), (215,176,83), 'nativity'),
    ('witness-01-catacomb.jpg', 'THE WITNESSES', 'Faith beneath the empire', (48,29,30), (175,120,54), 'catacomb'),
    ('witness-02-lamps.jpg', 'THE MARTYRS', 'Their lamps were not extinguished', (32,31,38), (204,147,62), 'lamps'),
    ('history-01-council.jpg', 'COUNCIL', 'The Church gathers in truth', (41,48,61), (190,147,77), 'council'),
    ('history-02-manuscript.jpg', 'MANUSCRIPT', 'Memory written by hand', (53,38,29), (205,162,89), 'manuscript'),
    ('history-03-monastery.jpg', 'MONASTERY', 'Prayer across the centuries', (34,51,53), (185,149,83), 'monastery'),
    ('history-04-pilgrimage.jpg', 'PILGRIMAGE', 'The road toward the holy place', (52,46,43), (204,160,84), 'pilgrimage'),
]

def font(path, size):
    return ImageFont.truetype(path, size)

TITLE = font(SERIF, 68)
SUB = font(SERIF, 30)
SMALL = font(SANS, 21)

def gradient(base, gold):
    y = np.linspace(0,1,H)[:,None,None]
    x = np.linspace(0,1,W)[None,:,None]
    b = np.array(base)[None,None,:]
    g = np.array(gold)[None,None,:]
    arr = b*(1-y*0.34) + g*(0.10*np.exp(-((x-0.72)**2+(y-0.36)**2)/0.09))
    arr = np.clip(arr,0,255)
    noise = np.random.default_rng(12345).normal(0, 8, (H,W,1))
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGB')

def mosaic(draw, gold, seed):
    rnd = random.Random(seed)
    for _ in range(620):
        x = rnd.randrange(0,W); y = rnd.randrange(0,H)
        s = rnd.randrange(4,18)
        a = rnd.randrange(18,65)
        col = tuple(min(255, int(c + rnd.randrange(-24,25))) for c in gold) + (a,)
        draw.rectangle((x,y,x+s,y+s), fill=col)

def glow_layer(cx, cy, radius, color):
    lay = Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(lay)
    d.ellipse((cx-radius,cy-radius,cx+radius,cy+radius), fill=color)
    return lay.filter(ImageFilter.GaussianBlur(radius//3))

def cross(draw, cx, cy, scale, gold, alpha=255):
    c = gold + (alpha,)
    w = int(28*scale)
    draw.rounded_rectangle((cx-w//2, cy-int(180*scale), cx+w//2, cy+int(190*scale)), radius=max(3,w//3), fill=c)
    draw.rounded_rectangle((cx-int(115*scale), cy-int(85*scale), cx+int(115*scale), cy-int(55*scale)), radius=7, fill=c)
    draw.rounded_rectangle((cx-int(85*scale), cy-int(135*scale), cx+int(85*scale), cy-int(113*scale)), radius=6, fill=c)
    draw.polygon([(cx-int(90*scale),cy+int(105*scale)),(cx+int(90*scale),cy+int(65*scale)),(cx+int(96*scale),cy+int(92*scale)),(cx-int(84*scale),cy+int(132*scale))], fill=c)

def dome(draw, x, y, w, h, gold, body=(35,30,38,255)):
    draw.rectangle((x,y+h*0.35,x+w,y+h), fill=body)
    draw.pieslice((x,y,x+w,y+h*0.72),180,360, fill=gold+(240,))
    draw.rectangle((x+w*.47,y-h*.12,x+w*.53,y+h*.08),fill=gold+(255,))
    draw.rectangle((x+w*.38,y-h*.03,x+w*.62,y+h*.02),fill=gold+(255,))
    for i in range(3):
        wx=x+w*(.2+i*.3)
        draw.rounded_rectangle((wx,y+h*.55,wx+w*.12,y+h*.9), radius=8, fill=(8,12,18,180))

def mountain(draw, gold):
    draw.polygon([(250,720),(790,180),(1310,720)], fill=(20,27,39,230))
    draw.polygon([(515,720),(790,180),(900,720)], fill=(50,61,75,220))
    for a in range(0,360,15):
        r1,r2=110,390
        x1=790+math.cos(math.radians(a))*r1; y1=270+math.sin(math.radians(a))*r1
        x2=790+math.cos(math.radians(a))*r2; y2=270+math.sin(math.radians(a))*r2
        draw.line((x1,y1,x2,y2), fill=gold+(110,), width=5)
    draw.ellipse((735,215,845,325), fill=(244,224,160,235))

def draw_scene(img, kind, gold, seed):
    ov = Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(ov)
    mosaic(d,gold,seed)
    img.alpha_composite(glow_layer(1140,310,300,gold+(85,)))
    if kind in {'cross','lent'}:
        cross(d, 1130, 410, 1.35 if kind=='cross' else 1.0, gold, 235)
        if kind=='lent':
            for i in range(9):
                x=500+i*75; d.ellipse((x,650,x+12,662),fill=gold+(140,))
    elif kind in {'nativity','water','temple','monastery'}:
        dome(d, 970, 285, 320, 340, gold, (31,29,39,235))
        dome(d, 780, 420, 220, 245, gold, (34,31,42,235))
        if kind=='water':
            for yy in range(650,860,24):
                d.arc((480,yy,1480,yy+70),0,180,fill=(194,218,225,135),width=4)
        if kind=='nativity':
            for r in range(35,280,30):
                d.ellipse((1120-r,210-r,1120+r,210+r), outline=gold+(max(25,150-r//2),), width=3)
            d.regular_polygon((1120,210,34),8,rotation=22.5,fill=(248,224,150,245))
    elif kind in {'pascha','ascension','pentecost','angels'}:
        for a in range(0,360,10):
            r1=90; r2=420 if kind=='pascha' else 330
            x1=1120+math.cos(math.radians(a))*r1; y1=390+math.sin(math.radians(a))*r1
            x2=1120+math.cos(math.radians(a))*r2; y2=390+math.sin(math.radians(a))*r2
            d.line((x1,y1,x2,y2),fill=gold+(95,),width=4)
        d.ellipse((995,265,1245,515),fill=(241,220,154,110),outline=gold+(220,),width=5)
        if kind=='pascha': cross(d,1120,390,.65,gold,255)
        elif kind=='pentecost':
            for i in range(12):
                a=2*math.pi*i/12
                x=1120+math.cos(a)*190; y=390+math.sin(a)*145
                d.polygon([(x,y-28),(x-15,y+14),(x,y+5),(x+15,y+14)],fill=(235,166,68,235))
        elif kind=='angels':
            d.arc((875,230,1120,540),285,75,fill=gold+(220,),width=18)
            d.arc((1120,230,1365,540),105,255,fill=gold+(220,),width=18)
    elif kind=='apostles':
        for i in range(8):
            x=760+i*95; y=520+((i%2)*35)
            d.ellipse((x,y-90,x+55,y-35),fill=gold+(210,))
            d.rounded_rectangle((x-12,y-35,x+67,y+140),radius=35,fill=(27,30,45,230),outline=gold+(110,),width=3)
        d.arc((700,170,1500,780),190,350,fill=gold+(150,),width=8)
    elif kind=='mountain': mountain(d,gold)
    elif kind=='veil':
        d.polygon([(700,220),(1450,220),(1280,670),(880,670)],fill=(223,223,219,120),outline=gold+(210,))
        d.arc((700,70,1450,540),190,350,fill=gold+(230,),width=10)
        for x in range(850,1320,115): d.line((x,260,x-80,640),fill=gold+(110,),width=3)
    elif kind=='catacomb':
        for x in [670,940,1210]:
            d.arc((x,180,x+270,760),180,360,fill=gold+(150,),width=14)
            d.line((x,470,x,820),fill=gold+(110,),width=8); d.line((x+270,470,x+270,820),fill=gold+(110,),width=8)
        cross(d,1080,520,.48,gold,220)
    elif kind=='lamps':
        for i in range(8):
            x=700+i*95; y=330+(i%3)*110
            d.ellipse((x-22,y-22,x+22,y+22),fill=(243,174,73,235))
            d.polygon([(x,y-70),(x-24,y-12),(x,y-24),(x+24,y-12)],fill=(249,200,105,240))
            d.line((x,y+22,x,y+145),fill=gold+(150,),width=5)
    elif kind=='council':
        d.arc((650,130,1500,820),180,360,fill=gold+(180,),width=14)
        for i in range(10):
            a=math.pi + math.pi*i/9
            x=1075+math.cos(a)*340; y=520+math.sin(a)*210
            d.ellipse((x-24,y-90,x+24,y-42),fill=gold+(210,))
            d.rounded_rectangle((x-38,y-42,x+38,y+85),radius=24,fill=(30,33,43,235),outline=gold+(100,),width=2)
    elif kind=='manuscript':
        d.rounded_rectangle((700,170,1450,730),radius=26,fill=(225,207,166,235),outline=gold+(255,),width=8)
        for yy in range(250,650,58):
            d.line((790,yy,1370,yy),fill=(78,47,32,170),width=4)
            d.line((790,yy+14,1240,yy+14),fill=(115,65,40,110),width=2)
        d.ellipse((750,215,860,325),outline=(126,38,44,210),width=10)
        cross(d,805,270,.18,(126,38,44),220)
    elif kind=='pilgrimage':
        d.polygon([(600,760),(900,440),(1180,760)],fill=(34,38,45,220))
        d.polygon([(900,760),(1220,310),(1510,760)],fill=(52,52,53,210))
        d.line((620,860,1110,430),fill=gold+(150,),width=14)
        for i in range(5):
            x=700+i*95; y=790-i*77
            d.ellipse((x-14,y-48,x+14,y-20),fill=gold+(215,))
            d.line((x,y-18,x,y+35),fill=gold+(180,),width=5)
    img.alpha_composite(ov)

def make(scene):
    filename,title,subtitle,base,gold,kind=scene
    img=gradient(base,gold).convert('RGBA')
    draw_scene(img,kind,gold,hash(filename)&0xffff)
    overlay=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(overlay)
    d.rectangle((0,H-220,W,H),fill=(8,7,10,145))
    d.line((120,H-198,520,H-198),fill=gold+(235,),width=4)
    d.text((120,H-180),title,font=TITLE,fill=(250,240,218,255))
    d.text((124,H-92),subtitle,font=SUB,fill=(228,207,162,255))
    d.text((W-390,H-54),'ORIGINAL DEVOTIONAL ARTWORK',font=SMALL,fill=(215,190,132,190))
    img.alpha_composite(overlay)
    img=img.convert('RGB')
    out=OUT/filename
    img.save(out,'JPEG',quality=93,subsampling=0,optimize=True,progressive=True)
    print(filename, out.stat().st_size)

for scene in SCENES:
    make(scene)
