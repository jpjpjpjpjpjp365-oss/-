// スマホの裏側で動くプログラム（Service Worker）を登録する
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
// HTMLの要素を取得
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

  // 💡 提出期限の日付から、自動で「曜日（月〜日）」を割り出す仕組み
  let targetDay = '';
  if (isRecurring && dueDate) {
    const dateObj = new Date(dueDate);
    const dayIndex = dateObj.getDay(); // 0(日)〜6(土)の数字が取れる
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
    targetDay: targetDay // 自動で割り出した曜日を保存する
  };

  addTaskToDOM(newTask);
  saveTaskToLocalStorage(newTask);

  // 入力欄をリセット
  taskTitleInput.value = '';
  courseNameInput.value = '';
  dueDateInput.value = '';
  isRecurringCheckbox.checked = false;
});
// 画面に課題のHTML要素を追加する関数（リマインド機能付き）
function addTaskToDOM(task) {
  const li = document.createElement('li');
  li.classList.add('task-item');
  li.setAttribute('data-id', task.id);

  // 定期課題かどうかの表示テキストを作る
  let dueDateText = `期限: ${task.dueDate}`;
  if (task.isRecurring) {
    dueDateText = `🔄 毎週 ${task.targetDay}曜日 (次回: ${task.dueDate})`;
  }

  // --- 📅 日付の比較（リマインド判定）の仕組み ---
  if (!task.isRecurring && task.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 時間をリセットして日付だけで比較する

    const dueDateObj = new Date(task.dueDate);
    dueDateObj.setHours(0, 0, 0, 0);

    // 日数の差を計算（ミリ秒から日へ変換）
    const diffTime = dueDateObj - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      // 期限が過ぎている場合
      li.classList.add('urgent');
      dueDateText += ' 【期限切れ！】';
    } else if (diffDays === 0) {
      // 今日が期限の場合
      li.classList.add('urgent');
      dueDateText += ' 【今日が期限です！】';
    } else if (diffDays === 1) {
      // 明日が期限の場合
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
// ブラウザの「localStorage」に課題を保存する関数
function saveTaskToLocalStorage(task) {
  let tasks = getTasksFromLocalStorage();
  tasks.push(task);
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// ローカルストレージから課題データを取得する関数
function getTasksFromLocalStorage() {
  let tasks = localStorage.getItem('tasks');
  if (tasks === null) {
    return [];
  }
  return JSON.parse(tasks);
}

// ページ読み込み時に保存されたデータを復元する関数
function loadTasks() {
  let tasks = getTasksFromLocalStorage();
  tasks.forEach(function(task) {
    addTaskToDOM(task);
  });
}

// 課題を削除する関数
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
// 1. 通知の許可を求める関数
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        alert("このブラウザは通知機能に対応していません。");
        return;
    }
    
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            alert("通知が許可されました！期限が来るとお知らせします。");
        } else {
            alert("通知が拒否されました。設定から許可してください。");
        }
    });
}

// 2. 期限をチェックして通知を送る関数
function checkTaskDeadlines() {
    // 保存されているタスクデータを取得（※コード内のタスク配列名に合わせて書き換えてください）
    // 例として tasks という配列に入っていると仮定します
    if (typeof tasks === "undefined") return;

    const now = new Date();

    tasks.forEach(task => {
        if (!task.dueDate) return;
        
        const dueDate = new Date(task.dueDate);
        
        // 期限の時刻と現在の時刻が「同じ日・同じ時間（分単位）」になったかを判定する例
        // （簡易的に、期限の日時を過ぎていて、かつまだ通知していない場合のチェックなど）
        if (now >= dueDate && !task.notified) {
            if (Notification.permission === "granted") {
                new Notification("⚠️ 期限のタスクがあります！", {
                    body: `「${task.title || task.content}」の期限になりました。`,
                    icon: "" // アイコン画像があれば指定可能
                });
                // 2回連続で通知されないようにフラグを立てる
                task.notified = true; 
            }
        }
    });
}

// 3. 1分ごとに期限をチェックするタイマーを動かす
setInterval(checkTaskDeadlines, 60000); // 60000ミリ秒 = 1分ごとにチェック

// ==========================================
// 1. 一番上：Service Worker（裏方）の登録
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
// 2. 真ん中：HTMLの要素取得 ＆ タスク追加・削除などのメイン処理
// ==========================================
const taskInput = document.getElementById('task-input');
const taskDate = document.getElementById('task-date');

// (ここにいつも書いてあるタスク管理のコード...)


// ==========================================
// 3. 一番下（または末尾）：通知を呼び出す関数 ＆ 1分ごとのチェック処理
// ==========================================

// ステップ3で作成した「通知を送る関数」
function sendBackgroundNotification(taskTitle) {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then(registration => {
        registration.showNotification("⚠️ 期限のタスクがあります！", {
            body: `「${taskTitle}」の期限になりました。`,
            icon: "", // 必要であればアイコン画像のパス
            badge: ""
        });
    });
}

// 期限をチェックして通知を動かすタイマー（例: 1分ごとに確認）
function checkDeadlines() {
    // ※ここでお持ちのタスク配列（tasksなど）の期限日時と現在時刻を判定し、
    // 期限が来たら sendBackgroundNotification(task.title) を呼び出します！
}

setInterval(checkDeadlines, 60000); // 1分ごとにチェック