export const copy = {
 ru: {
 consent:'Здравствуйте! Karate klub Budo, Таллин, Keldrimäe tn 9. Принимаем детей от 3 лет. Первые 2 тренировки бесплатно. Сначала уточним интерес, затем тренер распределит заявки по времени. Сохраним имя родителя, возраст ребёнка и контакт для организации занятия. Не отправляйте медицинские данные. /agree — согласиться, /uk — українська. /delete — удалить данные. Условия обработки: /privacy.',
 interest:'Хотите прийти на первые две бесплатные тренировки? /yes — да, /no — пока нет.', preferences:'Какие дни и время вам удобны? Напишите пожелания или /skip. Тренер распределит заявки по времени позже.', waiting:'Спасибо! Ваш интерес к двум бесплатным тренировкам подтверждён. Заявка в очереди; тренер свяжется с вами и согласует время. Автоматической записи пока нет.', declined:'Понял. Если захотите посетить бесплатные тренировки, напишите /yes.', assigned:'Время первой тренировки уже назначено тренером. Подробности — в сообщении с назначением. Первые 2 тренировки бесплатно.', info:'Karate klub Budo · Keldrimäe tn 9, Tallinn. Дети от 3 лет, новички и с опытом. Первые 2 тренировки бесплатно. По информации клуба, тренер — квалифицированный спортсмен с педагогическим образованием и многолетним опытом работы с детьми. Время и группу подбирает тренер после заявки. Цены дальнейших занятий пока не указаны.', parent:'Как к вам обращаться? Укажите имя родителя.', age:'Сколько лет ребёнку? Введите возраст целым числом, от 3 лет.', contact:'Укажите ваш телефон в международном формате (+372…) или Telegram @username.',
 slots:'Выберите занятие командой /book ID:\n', unavailable:'Свободных подтверждённых занятий пока нет. Заявка сохранена, время согласует тренер.',
 booked:'Пробная тренировка забронирована: ', full:'Место недоступно. Выберите другое время: /slots.', invalid:'Проверьте ответ и попробуйте ещё раз.',
 deleted:'Ваши данные удалены. Для новой заявки: /start.', privacy:'Данные используются для связи и записи на тренировку. Удаление: /delete. До запуска владелец клуба должен опубликовать свои контакты и политику обработки данных. Тестовый режим не предназначен для реальных заявок.',
 fallback:'Информацию уточнит тренер. Для записи: /start; свободное время: /slots.', consentRequired:'Сначала подтвердите согласие: /agree.',
 },
 uk: {
 consent:'Вітаю! Karate klub Budo, Таллінн, Keldrimäe tn 9. Приймаємо дітей від 3 років. Перші 2 тренування безкоштовні. Спочатку уточнимо інтерес, потім тренер розподілить заявки за часом. Збережемо ім’я батька/матері, вік дитини та контакт для організації заняття. Не надсилайте медичні дані. /agree — погодитися, /ru — русский. /delete — видалити дані. Умови: /privacy.',
 interest:'Хочете прийти на перші два безкоштовні тренування? /yes — так, /no — поки ні.', preferences:'Які дні та час вам зручні? Напишіть побажання або /skip. Тренер розподілить заявки за часом пізніше.', waiting:'Дякуємо! Ваш інтерес до двох безкоштовних тренувань підтверджено. Заявка в черзі; тренер зв’яжеться з вами та узгодить час. Автоматичного запису поки немає.', declined:'Зрозуміло. Якщо захочете відвідати безкоштовні тренування, напишіть /yes.', assigned:'Час першого тренування вже призначено тренером. Подробиці — у повідомленні з призначенням. Перші 2 тренування безкоштовні.', info:'Karate klub Budo · Keldrimäe tn 9, Tallinn. Діти від 3 років, новачки та з досвідом. Перші 2 тренування безкоштовні. За інформацією клубу, тренер — кваліфікований спортсмен із педагогічною освітою та багаторічним досвідом роботи з дітьми. Час і групу підбирає тренер після заявки. Ціни подальших занять поки не вказані.', parent:'Як до вас звертатися? Вкажіть ім’я батька або матері.', age:'Скільки років дитині? Введіть вік цілим числом, від 3 років.', contact:'Вкажіть ваш телефон у міжнародному форматі (+372…) або Telegram @username.',
 slots:'Оберіть заняття командою /book ID:\n', unavailable:'Підтверджених вільних занять поки немає. Заявку збережено, час узгодить тренер.',
 booked:'Пробне тренування заброньовано: ', full:'Місце недоступне. Оберіть інший час: /slots.', invalid:'Перевірте відповідь і спробуйте ще раз.',
 deleted:'Ваші дані видалено. Нова заявка: /start.', privacy:'Дані використовуються для зв’язку та запису на тренування. Видалення: /delete. До запуску власник клубу має опублікувати свої контакти та політику обробки даних. Тестовий режим не призначено для реальних заявок.',
 fallback:'Інформацію уточнить тренер. Запис: /start; вільний час: /slots.', consentRequired:'Спочатку підтвердьте згоду: /agree.',
 }
};
export function transition(lead, raw, slots=[], now=new Date().toISOString()) {
 const text=raw.trim(), t=copy[lead.language]||copy.ru;
 if (text==='/info') return {reply:t.info};
 if (text==='/privacy') return {reply:t.privacy};
 if (text==='/delete') return {remove:true,reply:t.deleted};
 if (['/ru','/uk'].includes(text)) { const language=text.slice(1); return {patch:{language},reply:copy[language][lead.step==='done'?'fallback':lead.step]||copy[language].consent}; }
 if (text==='/start') return {reply:lead.status==='booked'?t.assigned:t[lead.step]||t.fallback};
 if (text==='/agree'&&!lead.consent_at) return {patch:{consent_at:now,step:'interest'},reply:t.interest};
 if (!lead.consent_at) return {reply:t.consentRequired};
 if ((lead.step==='interest'||lead.status==='not_interested')&&text==='/yes') return {patch:{interested:1,step:'parent',status:'interested'},reply:t.parent};
 if (lead.step==='interest'&&text==='/no') return {patch:{interested:0,status:'not_interested'},reply:t.declined};
 if (lead.step==='interest') return {reply:t.interest};
 if (lead.step==='parent') return text.length>=2&&text.length<=80&&!text.startsWith('/') ? {patch:{parent:text,step:'age'},reply:t.age}:{reply:t.invalid};
 if (lead.step==='age') return /^\d{1,3}$/.test(text)&&+text>=3&&+text<=120 ? {patch:{age:+text,step:'contact'},reply:t.contact}:{reply:t.age};
 if (lead.step==='contact') return /^(\+[1-9]\d{7,14}|@[a-zA-Z][a-zA-Z0-9_]{4,31})$/.test(text) ? {patch:{contact:text,step:'preferences'},reply:t.preferences}:{reply:t.contact};
 if (lead.step==='preferences') return text==='/skip'||(!text.startsWith('/')&&text.length<=300) ? {patch:{preferred_times:text==='/skip'?null:text,step:'done',status:'awaiting_assignment'},reply:t.waiting}:{reply:t.preferences};
 if (text==='/slots'||text.startsWith('/book ')) return {reply:lead.status==='booked'?t.assigned:t.waiting};
 
 return {faq:true,reply:t.fallback};
}
export function slotText(t,slots) {return slots.length?t.slots+slots.map(s=>`${s.id} · ${s.label} · ${new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Tallinn',dateStyle:'medium',timeStyle:'short'}).format(new Date(s.starts_at))} (Tallinn)`).join('\n'):t.unavailable;}
