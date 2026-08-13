const fs = require('fs');
let text = fs.readFileSync('Frontend/src/app/App.tsx', 'utf8');

text = text.replace('import { AnalyticsOverview } from "./components/analytics/AnalyticsOverview";', 'import { DashCalendar } from "./components/calendar/CalendarOverview";');

text = text.replace('"voices"|"analytics"|"settings"', '"voices"|"calendar"|"settings"');

text = text.replace('{id:"analytics",icon:BarChart3,label:"Analytics"}', '{id:"calendar",icon:Calendar,label:"Calendar"}');

text = text.replace('analytics:"Analytics"', 'calendar:"Calendar & Schedule"');

text = text.replace('{section==="analytics"&&<DashAnalytics/>}', '{section==="calendar"&&<DashCalendar/>}');

if(!text.includes('Calendar') && text.includes('from "lucide-react";')) {
    text = text.replace('} from "lucide-react";', ', Calendar } from "lucide-react";');
}

fs.writeFileSync('Frontend/src/app/App.tsx', text, 'utf8');
console.log('App.tsx patched successfully');
