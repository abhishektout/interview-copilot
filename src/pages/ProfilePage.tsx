import React, { useState, useEffect } from 'react';
import { User, Plus, X, Save, CheckCircle } from 'lucide-react';
import { useProfileStore } from '../stores';

export function ProfilePage() {
  const { profile, saveProfile } = useProfileStore();
  const [form, setForm] = useState({
    name: profile?.name || '',
    targetRole: profile?.targetRole || '',
    experience: profile?.experience || '',
    skills: profile?.skills || [],
    projects: profile?.projects || [],
    preferredStyle: profile?.preferredStyle || 'normal',
    language: profile?.language || 'en',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        targetRole: profile.targetRole || '',
        experience: profile.experience || '',
        skills: profile.skills || [],
        projects: profile.projects || [],
        preferredStyle: profile.preferredStyle || 'normal',
        language: profile.language || 'en',
      });
    }
  }, [profile]);

  const [skillInput, setSkillInput] = useState('');
  const [projectInput, setProjectInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !form.skills.includes(s)) {
      setForm(f => ({ ...f, skills: [...f.skills, s] }));
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) =>
    setForm(f => ({ ...f, skills: f.skills.filter(s => s !== skill) }));

  const addProject = () => {
    const p = projectInput.trim();
    if (p && !form.projects.includes(p)) {
      setForm(f => ({ ...f, projects: [...f.projects, p] }));
    }
    setProjectInput('');
  };

  const removeProject = (proj: string) =>
    setForm(f => ({ ...f, projects: f.projects.filter(p => p !== proj) }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveProfile(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Candidate Profile</h1>
        <p className="page-subtitle">Your profile helps AI generate personalized answers</p>
      </div>

      <div style={{ maxWidth: 680 }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <User size={18} color="var(--accent-primary)" />
            <h3>Basic Information</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div className="input-group">
              <label className="input-label">Target Role</label>
              <input
                className="input"
                value={form.targetRole}
                onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))}
                placeholder="Senior Full Stack Developer"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="input-group">
              <label className="input-label">Years of Experience</label>
              <input
                className="input"
                value={form.experience}
                onChange={e => setForm(f => ({ ...f, experience: e.target.value }))}
                placeholder="3 years"
              />
            </div>
            <div className="input-group">
              <label className="input-label">Preferred Answer Style</label>
              <select
                className="select"
                value={form.preferredStyle}
                onChange={e => setForm(f => ({ ...f, preferredStyle: e.target.value }))}
              >
                <option value="concise">Concise (20-40s)</option>
                <option value="normal">Normal (45-90s)</option>
                <option value="technical">Technical</option>
                <option value="star">STAR Format</option>
                <option value="natural">Natural / Conversational</option>
              </select>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 16 }}>Technical Skills</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {form.skills.map(skill => (
              <div key={skill} className="chip">
                {skill}
                <button className="chip-remove" onClick={() => removeSkill(skill)}>
                  <X size={12} />
                </button>
              </div>
            ))}
            {form.skills.length === 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Add your technical skills</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSkill()}
              placeholder="React, Node.js, TypeScript..."
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary" onClick={addSkill}>
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>

        {/* Projects */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16 }}>Notable Projects</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {form.projects.map(proj => (
              <div key={proj} className="chip">
                {proj}
                <button className="chip-remove" onClick={() => removeProject(proj)}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={projectInput}
              onChange={e => setProjectInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addProject()}
              placeholder="E-commerce platform, ML pipeline..."
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary" onClick={addProject}>
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>

        <button
          className="btn btn-primary btn-lg"
          onClick={handleSave}
          disabled={isSaving || !form.name}
        >
          {isSaving ? (
            <><div className="spinner" /> Saving...</>
          ) : saved ? (
            <><CheckCircle size={18} /> Saved!</>
          ) : (
            <><Save size={18} /> Save Profile</>
          )}
        </button>
      </div>
    </div>
  );
}
