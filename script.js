let streak = localStorage.getItem('streak') || 0;
document.getElementById('streak').innerText = streak;

document.getElementById('addDay').addEventListener('click', () => {
  streak++;
  localStorage.setItem('streak', streak);
  document.getElementById('streak').innerText = streak;
});
