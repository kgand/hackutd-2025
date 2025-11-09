import React, { useState, useEffect, useRef } from 'react';
import './GlassSearchBar.css';
import AnimatedDots from './AnimatedDots';

const GlassSearchBar = ({ onNavigate }) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [topics, setTopics] = useState([]);
  const [cities, setCities] = useState([]);
  const glassRef = useRef(null);
  const inputRef = useRef(null);


  const hardcodedSuggestions = [
    'coverage in New York',
    'best t-mobile deals',
    'family plan perks'
  ];


  useEffect(() => {

    fetch('/api/sentiment/all')
      .then(res => res.json())
      .then(data => {
        const topicNames = [...new Set(data.map(item => item.topic))];
        setTopics(topicNames);
      })
      .catch(err => {
        console.error('Failed to load topics:', err);
      });


    fetch('/api/flattened')
      .then(res => res.json())
      .then(data => {
        const citySet = new Set();
        data.forEach(tweet => {
          if (tweet.location && tweet.location.city) {
            citySet.add(tweet.location.city);
          }
        });
        setCities(Array.from(citySet));
      })
      .catch(err => {
        console.error('Failed to load cities:', err);
      });
  }, []);

  const handleFocus = () => setShowSuggestions(true);
  const handleBlur = (e) => {
    if (!e.relatedTarget || !e.relatedTarget.closest('.search-suggestions')) {
      setShowSuggestions(false);
    }
  };
  const handleClear = () => {
    setInputValue('');
    inputRef.current?.focus();
  };
  const handleSuggestionClick = (query) => {

    const { city, topic } = detectCityAndTopic(query);


    if (city) {

      onNavigate?.('map', city, topic);
    } else {

      onNavigate?.('graph', undefined, topic);
    }
  };


  const detectCityAndTopic = (query) => {
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/);
    let foundCity = null;
    let foundTopic = null;


    const commonCities = [
      'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
      'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
      'fort worth', 'columbus', 'charlotte', 'san francisco', 'indianapolis',
      'seattle', 'denver', 'washington', 'boston', 'nashville', 'baltimore',
      'oklahoma city', 'portland', 'las vegas', 'detroit', 'memphis', 'louisville',
      'milwaukee', 'albuquerque', 'tucson', 'fresno', 'mesa', 'sacramento',
      'atlanta', 'kansas city', 'colorado springs', 'omaha', 'raleigh', 'miami',
      'oakland', 'minneapolis', 'tulsa', 'cleveland', 'wichita', 'arlington'
    ];


    for (const commonCity of commonCities) {
      if (lowerQuery.includes(commonCity)) {

        const matchedCity = cities.find(c => c.toLowerCase().includes(commonCity) || commonCity.includes(c.toLowerCase()));
        if (matchedCity) {
          foundCity = matchedCity;
        } else {

          foundCity = commonCity.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
        break;
      }
    }


    if (!foundCity) {
      for (const word of words) {
        for (const city of cities) {
          if (city.toLowerCase() === word || city.toLowerCase().includes(word) || word.includes(city.toLowerCase())) {
            foundCity = city;
            break;
          }
        }
        if (foundCity) break;
      }
    }


    if (!foundCity) {

      const topicKeywords = {
        '5g': 'T-Mobile 5G',
        'coverage': 'T-Mobile Coverage',
        'customer service': 'T-Mobile Customer Service',
        'service': 'T-Mobile Customer Service',
        'support': 'T-Mobile Support',
        'network': 'T-Mobile Network',
        'deal': 'T-Mobile Deals',
        'deals': 'T-Mobile Deals',
        'promotion': 'T-Mobile Promotions',
        'promotions': 'T-Mobile Promotions',
        'magenta monday': 'Magenta Monday',
        'home internet': 'T-Mobile Home Internet',
        'internet': 'T-Mobile Home Internet',
        'tuesdays': 'T-Mobile Tuesdays',
        'tuesday': 'T-Mobile Tuesdays',
        'trade-in': 'T-Mobile Trade-In',
        'trade in': 'T-Mobile Trade-In',
        'tradein': 'T-Mobile Trade-In',
        'upgrade': 'T-Mobile Upgrade',
        'billing': 'T-Mobile Billing',
        'bill': 'T-Mobile Billing',
        'store': 'T-Mobile Store',
        'plan': 'T-Mobile Plans',
        'plans': 'T-Mobile Plans',
        'family plan': 'T-Mobile Family Plan',
        'family': 'T-Mobile Family Plan',
        'prepaid': 'T-Mobile Prepaid',
        'business': 'T-Mobile Business',
        'roaming': 'T-Mobile Roaming',
        'app': 'T-Mobile App',
        'perks': 'T-Mobile Deals',
      };


      for (const [keyword, topicName] of Object.entries(topicKeywords)) {
        if (lowerQuery.includes(keyword)) {
          foundTopic = topicName;
          break;
        }
      }


      if (!foundTopic) {
        for (const topic of topics) {
          const topicLower = topic.toLowerCase();

          for (const word of words) {
            if (word.length > 2 && topicLower.includes(word)) {
              foundTopic = topic;
              break;
            }
          }
          if (foundTopic) break;
        }
      }
    }

    return { city: foundCity, topic: foundTopic };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const query = inputValue.trim();

    if (query !== '') {
      const { city, topic } = detectCityAndTopic(query);


      if (city) {

        onNavigate?.('map', city, topic);
      } else {

        onNavigate?.('graph', undefined, topic);
      }

      inputRef.current?.blur();
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    const currentRef = glassRef.current;
    const handleMouseMove = (e) => {
      if (!currentRef) return;
      const rect = currentRef.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const specular = currentRef.querySelector('.glass-specular');
      if (specular) {
        specular.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 30%, rgba(255,255,255,0) 60%)`;
      }
    };
    const handleMouseLeave = () => {
      if (!currentRef) return;
      const specular = currentRef.querySelector('.glass-specular');
      if (specular) {
        specular.style.background = 'none';
      }
    };
    currentRef?.addEventListener('mousemove', handleMouseMove);
    currentRef?.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      currentRef?.removeEventListener('mousemove', handleMouseMove);
      currentRef?.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div className="glass-search-container">
      <form
        className={`glass-search ${showSuggestions ? 'expanded' : ''}`}
        ref={glassRef}
        onSubmit={handleSubmit}
      >
        <div className="glass-filter" />
        <div className="glass-overlay" />
        <div className="glass-specular" />
        <div className="glass-content">
          <div className={`search-container ${showSuggestions ? 'expanded' : ''}`}>
            <button type="submit" className="search-button">
              <i className="fas fa-search search-icon" />
            </button>
            <input
              ref={inputRef}
              type="text"
              placeholder=""
              className="search-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit(e);
                }
              }}
            />
            {!inputValue && (
              <div className="placeholder">
                <AnimatedDots text="search" speed={300} />
              </div>
            )}
            <button type="button" className="search-clear" aria-label="Clear search" onClick={handleClear}>
              <i className="fas fa-times" />
            </button>
          </div>
          <div className={`search-suggestions ${showSuggestions || inputValue ? 'active' : ''}`}>
            <div className="suggestion-group">
              <h4>try searching...</h4>
              <ul>
                {hardcodedSuggestions.map((suggestion) => (
                  <li key={suggestion} onMouseDown={() => handleSuggestionClick(suggestion)}>
                    <i className="fas fa-search" />
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default GlassSearchBar;
