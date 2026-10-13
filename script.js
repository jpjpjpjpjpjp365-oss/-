// ==========================================
// 1. スマホの裏側で動くプログラム（Service Worker）の登録
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('裏方プログラムの登録成功:', reg);
            })
            .catch(err => {
                console.log('裏方プログラムの登録失敗:', err);
            });
    });
}

// ==========================================
// 2. HTMLの要素を取得
// ==========================================
const taskForm = document.getElementById('task-form');
const taskTitleInput = document.getElementById('task-title');
const courseNameInput = document.getElementById('course-name');
const dueDateInput = document.getElementById('due-date');
const taskList = document.getElementById('task-list');

// 定期課題用の要素を取得
const isRecurringCheckbox = document.getElementById('is-recurring');
const dayOfWeekGroup = document.getElementById('day-of-week-group');


// 「毎週繰り返す」のチェックが入ったら曜日選択を表示・非表示にする
isRecurringCheckbox.addEventListener('change', function() {
  if (isRecurringCheckbox.checked) {
    dayOfWeekGroup.style.display = 'block';
  } else {
    dayOfWeekGroup.style.display = 'none';
  }
});

// アプリ起動時に、保存されている課題を読み込んで画面に表示する
document.addEventListener('DOMContentLoaded', loadTasks);

// 課題を追加するフォームが送信されたときの処理
taskForm.addEventListener('submit', function(event) {
  event.preventDefault();

  const taskTitle = taskTitleInput.value;
  const courseName = courseNameInput.value;
  const dueDate = dueDateInput.value;
  const isRecurring = isRecurringCheckbox.checked;

  // 提出期限の日付から、自動で「曜日（月〜日）」を割り出す仕組み
  let targetDay = '';
  if (isRecurring && dueDate) {
    const dateObj = new Date(dueDate);
    const dayIndex = dateObj.getDay(); 
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    targetDay = dayNames[dayIndex];
  }

  // 新しい課題のオブジェクトを作る
  const newTask = {
    id: Date.now(),
    title: taskTitle,
    course: courseName,
    dueDate: dueDate,
    isRecurring: isRecurring,
    targetDay: targetDay
  };

  addTaskToDOM(newTask);
  saveTaskToLocalStorage(newTask);

  // 入力欄をリセット
  taskTitleInput.value = '';
  courseNameInput.value = '';
  dueDateInput.value = '';
  isRecurringCheckbox.checked = false;
});

// ==========================================
// 3. 画面描画・データ保存の関数群
// ==========================================

function addTaskToDOM(task) {
  const li = document.createElement('li');
  li.classList.add('task-item');
  li.setAttribute('data-id', task.id);

  let dueDateText = `期限: ${task.dueDate}`;
  if (task.isRecurring) {
    dueDateText = `🔄 毎週 ${task.targetDay}曜日 (次回: ${task.dueDate})`;
  }

  if (!task.isRecurring && task.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDateObj = new Date(task.dueDate);
    dueDateObj.setHours(0, 0, 0, 0);

    const diffTime = dueDateObj - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      li.classList.add('urgent');
      dueDateText += ' 【期限切れ！】';
    } else if (diffDays === 0) {
      li.classList.add('urgent');
      dueDateText += ' 【今日が期限です！】';
    } else if (diffDays === 1) {
      li.classList.add('warning');
      dueDateText += ' 【明日が期限です】';
    }
  }

  li.innerHTML = `
    <div class="task-info">
      <strong>${task.title}</strong> (${task.course})<br>
      <small>${dueDateText}</small>
    </div>
    <button class="delete-btn" onclick="deleteTask(${task.id})">削除</button>
  `;

  taskList.appendChild(li);
}

function saveTaskToLocalStorage(task) {
  let tasks = getTasksFromLocalStorage();
  tasks.push(task);
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function getTasksFromLocalStorage() {
  let tasks = localStorage.getItem('tasks');
  if (tasks === null) {
    return [];
  }
  return JSON.parse(tasks);
}

function loadTasks() {
  let tasks = getTasksFromLocalStorage();
  tasks.forEach(function(task) {
    addTaskToDOM(task);
  });
}

function deleteTask(id) {
  const li = document.querySelector(`[data-id="${id}"]`);
  if (li) {
    li.remove();
  }

  let tasks = getTasksFromLocalStorage();
  tasks = tasks.filter(function(task) {
    return task.id !== id;
  });
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// ==========================================
// 4. バックグラウンド通知関連の関数
// ==========================================

// 通知の許可を求める関数
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        alert("このブラウザは通知機能に対応していません。");
        return;
    }
    
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            alert("通知が許可されました！");
        } else {
            alert("通知が拒否されました。");
        }
    });
}

// Service Worker経由で通知を送る関数
function sendBackgroundNotification(taskTitle) {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then(registration => {
        registration.showNotification("⚠️ 期限のタスクがあります！", {
            body: `「${taskTitle}」の期限になりました。`,
            icon: "",
            badge: ""
        });
    });
}

// 期限をチェックする関数
function checkTaskDeadlines() {
    let tasks = getTasksFromLocalStorage();
    const now = new Date();

    tasks.forEach(task => {
        if (!task.dueDate) return;
        
        const dueDate = new Date(task.dueDate);
        
        if (now >= dueDate && !task.notified) {
            sendBackgroundNotification(task.title);
            task.notified = true; 
        }
    });
}

// 1分ごとに期限をチェックするタイマー
setInterval(checkTaskDeadlines, 60000);