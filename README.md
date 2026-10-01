# sellMyPorducts

A small web app that lets shoppers collect their orders from any site (Temu, Shein, etc.), write genuine reviews, share them with everyone in a collaborative feed, and optionally create their own affiliate page.

## Features


## Getting started

```bash
npm install
npm start      # starts the server on http://localhost:3000
```

Open `http://localhost:3000` in a browser to use the UI, or call the JSON API directly:

| Method | Path                         | Description                              |
| ------ | ---------------------------- | ----------------------------------------- |
| POST   | `/api/users`                 | Create/fetch a user                       |
| POST   | `/api/orders`                | Add an order for a user                   |
| GET    | `/api/orders/:username`      | List a user's orders                      |
| POST   | `/api/reviews`                | Write a review for one of your orders     |
| GET    | `/api/reviews`                | Shared feed of all reviews                |
| POST   | `/api/affiliate`              | Create/update your affiliate page         |
| GET    | `/api/affiliate/:slug`        | View a public affiliate page              |

## Tests

```bash
npm test
```

# sellMyProducts

אפליקציה לניהול מוצרים שהוזמנו מאתרי קניות כמו Temu ו-Shein, להצגת המוצרים ולכתיבת ביקורת אישית לכל מוצר.

## יכולות

- **המוצרים שלי**: הצגת כל המוצרים השמורים עבור שם משתמש.
- **פרטי מוצר**: תמונה, מחיר, אתר, קישור ותאריך הזמנה.
- **ביקורות**: כתיבת ביקורת ודירוג עבור מוצר אחד בכל פעם.
- **ייבוא Temu**: פתיחת דפדפן גלוי, התחברות ידנית ל-Temu וייבוא המוצרים שמופיעים בעמוד ההזמנות.
- **ביקורות משותפות**: API להצגת ביקורות שנכתבו על ידי משתמשים.

## הפעלה

```bash
npm install
npm start
```

פתחו בדפדפן:

```text
http://localhost:3000
```

## ייבוא מוצרים מ-Temu

בעמוד:

1. הזינו שם משתמש מקומי, לדוגמה `dana123`.
2. לחצו על **פתח Temu**.
3. התחברו ל-Temu בחלון שנפתח בעצמכם.
4. פתחו את עמוד ההזמנות שלכם ב-Temu.
5. לחצו על **ייבא את המוצרים**.

הסיסמה, קוד האימות וה-Cookies אינם נשלחים לשרת של האפליקציה. ההתחברות מתבצעת בחלון הדפדפן המקומי.

### חשוב לגבי Codespaces ו-Dev Containers

ייבוא Temu דורש סביבת מחשב עם תצוגה גרפית, מכיוון שהוא פותח דפדפן גלוי. בסביבת container ללא `DISPLAY` תופיע שגיאה מתאימה. במקרה כזה יש להריץ את הפרויקט מקומית על מחשב עם Chrome וסביבת Desktop.

הייבוא תלוי במבנה העמוד של Temu ועלול להפסיק לעבוד אם Temu משנה את האתר או חוסם אוטומציה. יש להשתמש בו בהתאם לתנאי השימוש של Temu.

## API

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/users` | יצירה או איתור משתמש |
| GET | `/api/products/:username` | הצגת כל המוצרים של המשתמש, כולל דירוג ממוצע |
| POST | `/api/products` | שמירת מוצר באפליקציה |
| POST | `/api/reviews` | כתיבת ביקורת למוצר או להזמנה |
| GET | `/api/reviews` | הצגת ביקורות משותפות |
| POST | `/api/import/temu/start` | פתיחת דפדפן Temu גלוי |
| GET | `/api/import/temu/status` | בדיקת מצב הייבוא |
| POST | `/api/import/temu/complete` | קריאת המוצרים מהעמוד הנוכחי ושמירתם |
| POST | `/api/import/temu/close` | סגירת דפדפן הייבוא |

## בדיקות

```bash
npm test
```
